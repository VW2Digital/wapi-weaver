"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { recordAudit } from "./audit.functions";
import crypto from "crypto";
import { hasCompanyAdminRole, hasMasterRole, isMaster } from "./roles";

type DebugJsonPrimitive = string | number | boolean | null;
type DebugJsonValue = DebugJsonPrimitive | DebugJsonObject | DebugJsonValue[];

interface DebugJsonObject {
  [key: string]: DebugJsonValue;
}

function toDebugJsonValue(value: unknown): DebugJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toDebugJsonValue(entry));
  }

  if (value && typeof value === "object") {
    const result: DebugJsonObject = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toDebugJsonValue(entry);
    }
    return result;
  }

  return String(value);
}

export const getCurrentUserRoles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: rawDb } = await import("./db");
    const rows = (await rawDb.query("SELECT role FROM user_roles WHERE user_id = ?", [
      context.userId,
    ])) as Array<{ role: string }>;
    const roles = (rows ?? []).map((r) => r.role);
    const isOwner = Boolean(context.userId && context.tenantId && context.userId === context.tenantId);
    const finalRoles =
      isOwner && !roles.includes("admin") && !roles.includes("admin_master")
        ? [...roles, "admin"]
        : roles;
    return {
      roles: finalRoles,
      isAdmin: isOwner || hasMasterRole(roles) || hasCompanyAdminRole(roles),
    };
  });

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // RLS bloqueia não-admins automaticamente
    const { data, error } = await context.db
      .from("platform_settings")
      .select(
        "meta_app_id, meta_config_id, meta_graph_version, updated_at, meta_app_secret, head_tags, body_tags, cron_secret, seo_title, seo_description, license_key",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      meta_app_id: data.meta_app_id ?? "",
      meta_config_id: data.meta_config_id ?? "",
      meta_graph_version: data.meta_graph_version ?? "v26.0",
      meta_app_secret_set: !!data.meta_app_secret,
      head_tags: (data as any).head_tags ?? "",
      body_tags: (data as any).body_tags ?? "",
      cron_secret: (data as any).cron_secret ?? "",
      seo_title: (data as any)?.seo_title ?? "",
      seo_description: (data as any)?.seo_description ?? "",
      license_key: (data as any)?.license_key ?? "",
      updated_at: data.updated_at,
    };
  });

export const getDetailedLicenseStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const rows = (await db.query("SELECT * FROM license_settings WHERE id = 1 LIMIT 1")) as any[];
    const data = rows?.[0] ?? null;

    if (!data) {
      return {
        status: "missing",
        plan: null,
        domain: null,
        expires_at: null,
        last_validated_at: null,
        last_error: "Licença não encontrada localmente.",
      };
    }

    return {
      status: data.license_status || "missing",
      plan: data.plan,
      domain: data.domain,
      expires_at: data.expires_at,
      last_validated_at: data.last_validated_at,
      last_error: data.last_error,
    };
  });

export const activateLicenseMutation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ licenseKey: z.string().min(1) }))
  .handler(async ({ data: { licenseKey }, context }) => {
    // Dynamically import activateLicense to avoid circular dependencies if any
    const { activateLicense } = await import("./license-verifier");
    const result = await activateLicense(licenseKey);
    if (!result.success) {
      throw new Error(result.error || "Erro ao ativar licença");
    }
    return { success: true };
  });

const settingsSchema = z.object({
  meta_app_id: z
    .string()
    .trim()
    .max(64)
    .regex(/^[0-9]*$/, "App ID deve conter apenas dígitos")
    .optional(),
  meta_app_secret: z.string().trim().max(256).optional(),
  meta_config_id: z
    .string()
    .trim()
    .max(64)
    .regex(/^[0-9]*$/, "Config ID deve conter apenas dígitos")
    .optional(),
  meta_graph_version: z
    .string()
    .trim()
    .max(10)
    .regex(/^v\d+\.\d+$/, "Formato deve ser vXX.X")
    .optional(),
  seo_title: z.string().max(128).nullable().optional(),
  seo_description: z.string().max(320).nullable().optional(),
  head_tags: z.string().max(20000).nullable().optional(),
  body_tags: z.string().max(20000).nullable().optional(),
  cron_secret: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9_-]*$/, "Use apenas letras, dígitos, _ ou -")
    .nullable()
    .optional(),
  license_key: z.string().trim().max(256).nullable().optional(),
});

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.meta_app_id !== undefined && data.meta_app_id !== "")
      update.meta_app_id = data.meta_app_id;
    if (data.meta_app_secret !== undefined && data.meta_app_secret !== "")
      update.meta_app_secret = data.meta_app_secret;
    if (data.meta_config_id !== undefined && data.meta_config_id !== "")
      update.meta_config_id = data.meta_config_id;
    if (data.meta_graph_version) update.meta_graph_version = data.meta_graph_version;
    if (data.seo_title !== undefined) update.seo_title = data.seo_title || null;
    if (data.seo_description !== undefined) update.seo_description = data.seo_description || null;
    if (data.head_tags !== undefined)
      update.head_tags = data.head_tags === "" ? null : data.head_tags;
    if (data.body_tags !== undefined)
      update.body_tags = data.body_tags === "" ? null : data.body_tags;
    if (data.cron_secret !== undefined)
      update.cron_secret = data.cron_secret === "" ? null : data.cron_secret;
    if (data.license_key !== undefined)
      update.license_key = data.license_key === "" ? null : data.license_key;

    const { error } = await context.db.from("platform_settings").upsert({
      id: 1,
      ...update,
    } as never);

    if (error) throw error;

    // Trigger key activation on update
    if (data.license_key) {
      const { activateLicense } = await import("./license-verifier");
      const actRes = await activateLicense(data.license_key);
      if (!actRes.success) {
        throw new Error(actRes.error || "Falha ao ativar a licença.");
      }
    }

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "platform_settings.update",
      entityType: "platform_settings",
      entityId: "1",
      metadata: {
        changed: Object.keys(update).filter((k) => k !== "updated_at" && k !== "updated_by"),
      },
    });
    return { ok: true };
  });

// Público (sem auth) — retorna seo_title e seo_description para injetar no head.
export const getSeoSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { dbAdmin } = await import("@/integrations/mysql/client.server");
    const { data, error } = await dbAdmin
      .from("platform_settings")
      .select("seo_title, seo_description")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { seo_title: "", seo_description: "" };
    return {
      seo_title: (data as any)?.seo_title ?? "",
      seo_description: (data as any)?.seo_description ?? "",
    };
  } catch (error: unknown) {
    return { seo_title: "", seo_description: "" };
  }
});

// Público (sem auth) — retorna apenas head_tags/body_tags para injetar em todas as páginas.
// Usa o cliente admin para contornar RLS, mas só expõe esses dois campos.
export const getTrackingTags = createServerFn({ method: "GET" }).handler(async () => {
  const { dbAdmin } = await import("@/integrations/mysql/client.server");
  const { data, error } = await dbAdmin
    .from("platform_settings")
    .select("head_tags, body_tags")
    .eq("id", 1)
    .maybeSingle();
  if (error) return { head_tags: "", body_tags: "" };
  return {
    head_tags: (data as any)?.head_tags ?? "",
    body_tags: (data as any)?.body_tags ?? "",
  };
});

// Exporta o schema completo do banco (apenas admins). Usa dbAdmin (service_role)
// para chamar a função SECURITY DEFINER `public.export_schema_sql()`.
export const exportSchemaSql = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // Confirma admin via RLS antes de usar o admin client
    const { data: roles } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = hasMasterRole((roles ?? []).map((r: any) => r.role));
    if (!isAdmin) throw new Error("forbidden");

    const { promises: fs } = await import("fs");
    const path = await import("path");
    let sql = "";
    try {
      const schemaPath = path.join(process.cwd(), "schema_mysql.sql");
      sql = await fs.readFile(schemaPath, "utf-8");
    } catch (err: any) {
      throw new Error(`Failed to read schema file: ${err.message}`);
    }

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "platform.export_schema",
      entityType: "database",
      entityId: "public",
      metadata: { bytes: sql.length },
    });

    return { sql, generated_at: new Date().toISOString() };
  });

async function assertAdmin(ctx: { db: any; userId: string; claims?: any }) {
  const claimRole = ctx.claims?.role as string | undefined;
  if (isMaster(claimRole)) return;

  const { data: roles } = await ctx.db.from("user_roles").select("role").eq("user_id", ctx.userId);
  const isAdmin = hasMasterRole((roles ?? []).map((r: any) => r.role));
  if (!isAdmin) throw new Error("forbidden");
}

// Lista o histórico de backups do schema (somente metadados — sem o SQL).
export const listSchemaBackups = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.db
      .from("schema_backups")
      .select("id, created_at, source, size_bytes, created_by")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return { backups: data ?? [] };
  });

// Retorna o SQL completo de um backup específico para download.
export const getSchemaBackup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.db
      .from("schema_backups")
      .select("id, created_at, source, size_bytes, sql")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("not_found");
    return row;
  });

// Gera um backup manual sob demanda (apenas admins).
export const createSchemaBackupNow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { promises: fs } = await import("fs");
    const path = await import("path");
    const crypto = await import("crypto");

    let sql = "";
    try {
      const schemaPath = path.join(process.cwd(), "schema_mysql.sql");
      sql = await fs.readFile(schemaPath, "utf-8");
    } catch (err: any) {
      throw new Error(`Failed to read schema file: ${err.message}`);
    }

    const backupId = crypto.randomUUID();
    const sizeBytes = Buffer.byteLength(sql, "utf-8");

    const { dbAdmin } = await import("@/integrations/mysql/client.server");
    const { error } = await dbAdmin.from("schema_backups").insert({
      id: backupId,
      created_by: context.userId,
      source: "manual",
      sql: sql,
      size_bytes: sizeBytes,
      created_at: new Date().toISOString(),
    } as any);

    if (error) throw new Error(error.message);

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "platform.schema_backup.manual",
      entityType: "schema_backup",
      entityId: backupId,
    });

    return { id: backupId };
  });

// Exclui um backup (apenas admins).
export const deleteSchemaBackup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.db.from("schema_backups").delete().eq("id", data.id);
    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "platform.schema_backup.delete",
      entityType: "schema_backup",
      entityId: data.id,
    });
    return { ok: true };
  });

export const getSidebarOrder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db
      .from("platform_settings")
      .select("sidebar_order")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return { order: (data as any)?.sidebar_order ?? null };
  });

export const updateSidebarOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ order: z.string().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.db.from("platform_settings").upsert({
      id: 1,
      sidebar_order: data.order,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    } as never);
    if (error) throw error;

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "platform_settings.update_sidebar_order",
      entityType: "platform_settings",
      entityId: "1",
      metadata: { has_custom_order: !!data.order },
    });
    return { ok: true };
  });

export const getLicenseStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tenantId = context.tenantId;
    const claims = context.claims as any;
    const email = claims?.email;

    const { default: db } = await import("./db");

    // First try by tenant_id
    let rows = (await db.query(
      "SELECT status, expires_at FROM licenses WHERE tenant_id = ? LIMIT 1",
      [tenantId],
    )) as any[];

    // Fallback: search by email if not found by tenant_id
    if ((!rows || rows.length === 0) && email) {
      rows = (await db.query(
        "SELECT status, expires_at FROM licenses WHERE LOWER(TRIM(client_email)) = ? LIMIT 1",
        [String(email).trim().toLowerCase()],
      )) as any[];
    }

    if (rows && rows.length > 0) {
      const sub = rows[0];
      const isExpired = sub.expires_at ? new Date(sub.expires_at) < new Date() : false;
      const isAccessAllowed = sub.status === "active" && !isExpired;

      if (!isAccessAllowed) {
        return {
          isValid: false,
          isAccessAllowed: false,
          graceDaysRemaining: 0,
          hasGraceStarted: false,
          status: sub.status || "expired",
        };
      }
    }

    if (claims && isMaster(claims.role)) {
      return {
        isValid: true,
        isAccessAllowed: true,
        graceDaysRemaining: 0,
        hasGraceStarted: false,
        status: "active",
      };
    }

    if (!rows || rows.length === 0) {
      return {
        isValid: false,
        isAccessAllowed: false,
        graceDaysRemaining: 0,
        hasGraceStarted: false,
        status: "expired",
      };
    }

    const sub = rows[0];
    const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
    const isAccessAllowed = sub.status === "active" && !isExpired;

    return {
      isValid: sub.status === "active" && !isExpired,
      isAccessAllowed,
      graceDaysRemaining: 0,
      hasGraceStarted: false,
      status: isAccessAllowed ? "active" : (sub.status || "expired"),
    };
  });

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");

    // Busca a licença pelo tenant_id do usuário logado
    let rows = (await db.query(
      `SELECT l.plan, l.status, l.expires_at, l.client_name
       FROM licenses l
       WHERE l.tenant_id = ?
       LIMIT 1`,
      [context.userId],
    )) as any[];

    // Fallback: busca pelo email do usuário se não encontrou pelo tenant_id
    if (!rows || rows.length === 0) {
      rows = (await db.query(
        `SELECT l.plan, l.status, l.expires_at, l.client_name
         FROM licenses l
         JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(l.client_email))
         WHERE u.id = ?
         LIMIT 1`,
        [context.userId],
      )) as any[];
    }

    if (!rows || rows.length === 0) {
      return { plan_name: null, status: null, expires_at: null };
    }

    const lic = rows[0];

    // Tenta buscar detalhes do plano pela tabela billing_plans usando o nome do plano
    let planDetails: any = null;
    if (lic.plan) {
      const planRows = (await db.query(
        `SELECT name, price, currency, billing_interval
         FROM billing_plans
         WHERE LOWER(id) = LOWER(?) OR LOWER(name) = LOWER(?)
         LIMIT 1`,
        [lic.plan, lic.plan],
      )) as any[];
      planDetails = planRows?.[0] ?? null;
    }

    // O nome exibível: usa billing_plans.name se encontrou, senão capitaliza o campo plan
    const planName = planDetails?.name
      ?? (lic.plan
        ? lic.plan.charAt(0).toUpperCase() + lic.plan.slice(1)
        : null);

    return {
      plan_name: planName,
      status: lic.status ?? null,
      expires_at: lic.expires_at ? new Date(lic.expires_at).toISOString() : null,
      price: planDetails?.price ?? null,
      currency: planDetails?.currency ?? "BRL",
      billing_interval: planDetails?.billing_interval ?? null,
    };
  });
