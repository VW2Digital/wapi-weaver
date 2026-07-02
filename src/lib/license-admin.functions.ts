import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import {
  generateLicenseKey,
  licenseHash,
  previewLicenseKey,
  mysqlDate,
  parseJson
} from "./license-server";

// Helper to assert administrator privileges in panel mode
async function assertAdmin(ctx: { userId: string }) {
  if (process.env.LICENSE_ROLE !== "panel") {
    throw new Error("Acesso negado: o Painel de Licenças está inativo nesta instalação.");
  }
  const rows = (await db.query(
    "SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
    [ctx.userId]
  )) as any[];
  if (!rows.length) {
    throw new Error("Acesso negado: apenas administradores.");
  }
}

// 1. List licenses
export const listLicenses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      plan: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20)
    })
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const { search, status, plan, page, limit } = input;
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM licenses WHERE 1=1";
    const params: any[] = [];

    if (search) {
      sql += " AND (client_name LIKE ? OR client_email LIKE ? OR license_key_preview LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (plan && plan !== "all") {
      sql += " AND plan = ?";
      params.push(plan);
    }

    // Get total count
    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS total");
    const countResult = (await db.query(countSql, params)) as any[];
    const total = countResult[0]?.total || 0;

    // Get paginated rows
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = (await db.query(sql, params)) as any[];

    return {
      licenses: rows.map((r: any) => ({
        ...r,
        features_json: parseJson(r.features_json)
      })),
      total,
      pages: Math.ceil(total / limit)
    };
  });

// 2. Create license
export const createLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      client_name: z.string().trim().min(1, "Nome do cliente é obrigatório"),
      client_email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
      domain: z.string().trim().min(1, "Domínio é obrigatório"),
      product_name: z.string().default("SaaS"),
      app_id: z.string().default("meu-saas"),
      plan: z.string().default("basic"),
      status: z.string().default("active"),
      expires_at: z.string().nullable().optional(),
      max_activations: z.number().default(99),
      max_users: z.number().nullable().optional(),
      features_json: z.record(z.any()).optional(),
      notes: z.string().optional()
    })
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const licenseKey = input.domain.toLowerCase();
    const keyHash = licenseHash(licenseKey);
    const keyPreview = licenseKey;

    const expiresDate = input.expires_at ? mysqlDate(input.expires_at) : null;
    const features = input.features_json || { max_users: input.max_users || 1 };

    try {
      await db.query(
        `INSERT INTO licenses
         (license_key_hash, license_key_preview, client_name, client_email, product_name, app_id, plan, status, expires_at, max_activations, max_users, features_json, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
        [
          keyHash,
          keyPreview,
          input.client_name || null,
          input.client_email || null,
          input.product_name,
          input.app_id,
          input.plan,
          input.status,
          expiresDate,
          input.max_activations,
          input.max_users || null,
          JSON.stringify(features),
          input.notes || null
        ]
      );

      return {
        success: true,
        licenseKey,
        preview: keyPreview
      };
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        throw new Error("Erro: Essa licença já foi cadastrada.");
      }
      throw err;
    }
  });

// 3. Get detailed license stats for dashboard
export const getLicenseStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const totalRes = (await db.query("SELECT COUNT(*) AS total FROM licenses")) as any[];
    const activeRes = (await db.query("SELECT COUNT(*) AS total FROM licenses WHERE status = 'active'")) as any[];
    const expiredRes = (await db.query("SELECT COUNT(*) AS total FROM licenses WHERE status = 'expired' OR (expires_at IS NOT NULL AND expires_at < NOW())")) as any[];
    const blockedRes = (await db.query("SELECT COUNT(*) AS total FROM licenses WHERE status = 'blocked'")) as any[];

    const totalActivations = (await db.query("SELECT COUNT(*) AS total FROM license_activations WHERE status = 'active'")) as any[];

    // Recent 10 activations
    const recentActivations = (await db.query(
      `SELECT la.*, l.client_name, l.license_key_preview
       FROM license_activations la
       JOIN licenses l ON la.license_id = l.id
       ORDER BY la.activated_at DESC LIMIT 10`
    )) as any[];

    return {
      totals: {
        total: totalRes[0]?.total || 0,
        active: activeRes[0]?.total || 0,
        expired: expiredRes[0]?.total || 0,
        blocked: blockedRes[0]?.total || 0,
        activations: totalActivations[0]?.total || 0
      },
      recentActivations
    };
  });

// 4. Get individual license details
export const getLicenseDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const licenseRows = (await db.query("SELECT * FROM licenses WHERE id = ? LIMIT 1", [input.id])) as any[];
    if (!licenseRows.length) {
      throw new Error("Licença não encontrada");
    }

    const license = licenseRows[0];
    license.features_json = parseJson(license.features_json);

    // Get activations
    const activations = (await db.query(
      "SELECT * FROM license_activations WHERE license_id = ? ORDER BY activated_at DESC",
      [input.id]
    )) as any[];

    // Get logs
    const logs = (await db.query(
      "SELECT * FROM license_validation_logs WHERE license_id = ? ORDER BY created_at DESC LIMIT 100",
      [input.id]
    )) as any[];

    return {
      license,
      activations,
      logs
    };
  });

// 5. Update license
export const updateLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      id: z.number(),
      client_name: z.string().trim().min(1),
      client_email: z.string().trim().email().optional().or(z.literal("")),
      plan: z.string(),
      status: z.string(),
      expires_at: z.string().nullable().optional(),
      max_activations: z.number(),
      max_users: z.number().nullable().optional(),
      notes: z.string().nullable().optional()
    })
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const expiresDate = input.expires_at ? mysqlDate(input.expires_at) : null;

    await db.query(
      `UPDATE licenses
       SET client_name = ?, client_email = ?, plan = ?, status = ?, expires_at = ?, max_activations = ?, max_users = ?, notes = ?
       WHERE id = ?`,
      [
        input.client_name,
        input.client_email || null,
        input.plan,
        input.status,
        expiresDate,
        input.max_activations,
        input.max_users || null,
        input.notes || null,
        input.id
      ]
    );

    return { success: true };
  });

// 6. Delete license
export const deleteLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    await db.query("DELETE FROM licenses WHERE id = ?", [input.id]);
    return { success: true };
  });

// 7. Delete activation
export const deleteActivation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    await db.query("DELETE FROM license_activations WHERE id = ?", [input.id]);
    return { success: true };
  });

export const getLicenseRole = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const role = process.env.LICENSE_ROLE || "saas";
    let isAdmin = false;
    try {
      const rows = (await db.query(
        "SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
        [context.userId]
      )) as any[];
      if (rows.length > 0) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("[getLicenseRole Error]", e);
    }
    return { role, isAdmin };
  });
