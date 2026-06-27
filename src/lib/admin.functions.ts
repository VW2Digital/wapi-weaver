import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { recordAudit } from "./audit.functions";
import crypto from "crypto";

export const getCurrentUserRoles = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    return { roles, isAdmin: roles.includes("admin") };
  });

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // RLS bloqueia não-admins automaticamente
    const { data, error } = await context.db
      .from("platform_settings")
      .select(
        "meta_app_id, meta_config_id, meta_graph_version, updated_at, meta_app_secret, head_tags, body_tags, cron_secret, seo_title, seo_description",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      meta_app_id: data.meta_app_id ?? "",
      meta_config_id: data.meta_config_id ?? "",
      meta_graph_version: data.meta_graph_version ?? "v20.0",
      meta_app_secret_set: !!data.meta_app_secret,
      head_tags: (data as any).head_tags ?? "",
      body_tags: (data as any).body_tags ?? "",
      cron_secret: (data as any).cron_secret ?? "",
      seo_title: (data as any)?.seo_title ?? "",
      seo_description: (data as any)?.seo_description ?? "",
      updated_at: data.updated_at,
    };
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
  seo_title: z.string().max(128).optional(),
  seo_description: z.string().max(320).optional(),
  head_tags: z.string().max(20000).optional(),
  body_tags: z.string().max(20000).optional(),
  cron_secret: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9_-]*$/, "Use apenas letras, dígitos, _ ou -")
    .optional(),
});

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => settingsSchema.parse(d))
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

    const { error } = await context.db.from("platform_settings").upsert({
      id: 1,
      ...update,
    } as never);

    if (error) throw error;
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
  } catch {
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
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
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

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
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
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
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
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
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
  .inputValidator((d) => z.object({ order: z.string().nullable() }).parse(d))
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
