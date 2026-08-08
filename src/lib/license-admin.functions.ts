"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import bcrypt from "bcryptjs";
import db from "./db";
import {
  generateLicenseKey,
  licenseHash,
  previewLicenseKey,
  mysqlDate,
  parseJson,
} from "./license-server";
import { hasMasterRole } from "./roles";

// Helper to assert administrator privileges in panel mode
async function assertAdmin(ctx: { userId: string }) {
  const rows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    ctx.userId,
  ])) as Array<{ role: string }>;
  if (!hasMasterRole(rows.map(({ role }) => role))) {
    throw new Error(
      "Acesso negado: apenas o administrador master (adminmaster) da plataforma tem permissão.",
    );
  }
}

// 1. List licenses
export const listLicenses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      plan: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }),
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
        features_json: parseJson(r.features_json),
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  });

// 2. Create license
export const createLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
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
      features_json: z.record(z.string(), z.any()).optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    // Link tenant_id if user exists
    let tenantId = null;
    if (input.client_email) {
      const userRows = (await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
        input.client_email.trim().toLowerCase(),
      ])) as any[];
      if (userRows.length > 0) {
        tenantId = userRows[0].id;
      }
    }

    const licenseKey = input.domain.toLowerCase();
    const keyHash = licenseHash(licenseKey);
    const keyPreview = licenseKey;

    const expiresDate = input.expires_at ? mysqlDate(input.expires_at) : null;
    const features = input.features_json || { max_users: input.max_users || 1 };

    const licenseId = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO licenses
         (id, license_key_hash, license_key_preview, client_name, client_email, product_name, app_id, plan, status, expires_at, max_activations, max_users, features_json, notes, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
        [
          licenseId,
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
          input.notes || null,
          tenantId,
        ],
      );

      return {
        success: true,
        licenseKey,
        preview: keyPreview,
      };
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY" || err.errno === 1062 || String(err.message).includes("license_key_hash")) {
        throw new Error("Já existe uma licença / cliente cadastrado com este e-mail ou domínio.");
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
    const activeRes = (await db.query(
      "SELECT COUNT(*) AS total FROM licenses WHERE status = 'active'",
    )) as any[];
    const expiredRes = (await db.query(
      "SELECT COUNT(*) AS total FROM licenses WHERE status = 'expired' OR (expires_at IS NOT NULL AND expires_at < NOW())",
    )) as any[];
    const blockedRes = (await db.query(
      "SELECT COUNT(*) AS total FROM licenses WHERE status = 'blocked'",
    )) as any[];

    const totalActivations = (await db.query(
      "SELECT COUNT(*) AS total FROM license_activations WHERE status = 'active'",
    )) as any[];

    // Recent 10 activations
    const recentActivations = (await db.query(
      `SELECT la.*, l.client_name, l.license_key_preview
       FROM license_activations la
       JOIN licenses l ON la.license_id = l.id
       ORDER BY la.activated_at DESC LIMIT 10`,
    )) as any[];

    return {
      totals: {
        total: totalRes[0]?.total || 0,
        active: activeRes[0]?.total || 0,
        expired: expiredRes[0]?.total || 0,
        blocked: blockedRes[0]?.total || 0,
        activations: totalActivations[0]?.total || 0,
      },
      recentActivations,
    };
  });

// 4. Get individual license details
export const getLicenseDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const licenseRows = (await db.query("SELECT * FROM licenses WHERE id = ? LIMIT 1", [
      input.id,
    ])) as any[];
    if (!licenseRows.length) {
      throw new Error("Licença não encontrada");
    }

    const license = licenseRows[0];
    license.features_json = parseJson(license.features_json);

    // Get activations
    const activations = (await db.query(
      "SELECT * FROM license_activations WHERE license_id = ? ORDER BY activated_at DESC",
      [input.id],
    )) as any[];

    // Get logs
    const logs = (await db.query(
      "SELECT * FROM license_validation_logs WHERE license_id = ? ORDER BY created_at DESC LIMIT 100",
      [input.id],
    )) as any[];

    return {
      license,
      activations,
      logs,
    };
  });

// 5. Update license
export const updateLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().min(1),
      client_name: z.string().trim().min(1),
      client_email: z.string().trim().email().optional().or(z.literal("")),
      plan: z.string(),
      status: z.string(),
      expires_at: z.string().nullable().optional(),
      max_activations: z.number(),
      max_users: z.number().nullable().optional(),
      new_password: z.string().optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    const expiresDate = input.expires_at ? mysqlDate(input.expires_at) : null;

    // Re-resolve tenant_id from updated email
    let tenantId: string | null = null;
    if (input.client_email) {
      const userRows = (await db.query(
        "SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1",
        [input.client_email],
      )) as any[];
      if (userRows.length > 0) {
        tenantId = userRows[0].id;

        // Se foi enviada uma nova senha, atualiza o usuário no banco
        if (input.new_password && input.new_password.trim() !== "") {
          const passwordHash = await bcrypt.hash(input.new_password, 10);
          await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [
            passwordHash,
            tenantId,
          ]);
        }
      }
    }

    try {
      await db.query(
        `UPDATE licenses
         SET client_name = ?, client_email = ?, plan = ?, status = ?, expires_at = ?, max_activations = ?, max_users = ?, notes = ?, tenant_id = ?
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
          tenantId,
          input.id,
        ],
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY" || err.errno === 1062 || String(err.message).includes("licenses.")) {
        throw new Error("Já existe outro cliente / licença cadastrada com este e-mail ou domínio.");
      }
      throw err;
    }

    return { success: true };
  });

// 6. Delete license
export const deleteLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    // Buscar tenant_id e client_email da licença antes de excluir
    const rows = (await db.query("SELECT tenant_id, client_email FROM licenses WHERE id = ? LIMIT 1", [
      input.id,
    ])) as any[];

    if (rows.length > 0) {
      const { tenant_id, client_email } = rows[0];

      // Deletar a licença
      await db.query("DELETE FROM licenses WHERE id = ?", [input.id]);

      // Deletar a conta do usuário caso não seja um adminmaster protegido
      let userIdToDelete = tenant_id;
      if (!userIdToDelete && client_email) {
        const uRows = (await db.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1", [
          client_email,
        ])) as any[];
        if (uRows.length > 0) userIdToDelete = uRows[0].id;
      }

      if (userIdToDelete && userIdToDelete !== context.userId) {
        // Verificar se é protegida (adminmaster)
        const roleRows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
          userIdToDelete,
        ])) as any[];
        const isMasterUser = roleRows.some((r: any) => r.role === "admin_master");

        if (!isMasterUser) {
          await db.query("DELETE FROM user_roles WHERE user_id = ?", [userIdToDelete]);
          await db.query("DELETE FROM profiles WHERE id = ?", [userIdToDelete]);
          await db.query("DELETE FROM users WHERE id = ?", [userIdToDelete]);
        }
      }
    } else {
      await db.query("DELETE FROM licenses WHERE id = ?", [input.id]);
    }

    return { success: true };
  });

// 7. Delete activation
export const deleteActivation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    await db.query("DELETE FROM license_activations WHERE id = ?", [input.id]);
    return { success: true };
  });

export const getLicenseRole = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    let isAdmin = false;
    try {
      const rows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
        context.userId,
      ])) as Array<{ role: string }>;
      if (hasMasterRole(rows.map(({ role }) => role))) {
        isAdmin = true;
      }
    } catch (e) {
      console.error("[getLicenseRole Error]", e);
    }
    return { role: isAdmin ? "panel" : "saas", isAdmin };
  });

// --- PLANS MANAGEMENT ---

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const plans = (await db.query(
      "SELECT * FROM subscription_plans ORDER BY created_at ASC",
    )) as any[];
    return { plans };
  });

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      name: z.string().trim().min(1),
      slug: z.string().trim().min(1),
      description: z.string().optional(),
      max_agents: z.number().default(1),
      max_funnels: z.number().default(1),
      max_users: z.number().default(1),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO subscription_plans (id, name, slug, description, max_agents, max_funnels, max_users, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.slug,
        input.description || null,
        input.max_agents,
        input.max_funnels,
        input.max_users,
        input.is_active,
      ],
    );
    return { success: true, id };
  });

export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1),
      slug: z.string().trim().min(1),
      description: z.string().optional(),
      max_agents: z.number().default(1),
      max_funnels: z.number().default(1),
      max_users: z.number().default(1),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);
    await db.query(
      `UPDATE subscription_plans
       SET name = ?, slug = ?, description = ?, max_agents = ?, max_funnels = ?, max_users = ?, is_active = ?
       WHERE id = ?`,
      [
        input.name,
        input.slug,
        input.description || null,
        input.max_agents,
        input.max_funnels,
        input.max_users,
        input.is_active,
        input.id,
      ],
    );
    return { success: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);
    await db.query("DELETE FROM subscription_plans WHERE id = ?", [input.id]);
    return { success: true };
  });

// --- COMMERCIAL PLANS (BILLING_PLANS) ---

export const listCommercialPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const plans = (await db.query(
      "SELECT bp.*, sp.name as subscription_plan_name FROM billing_plans bp LEFT JOIN subscription_plans sp ON bp.subscription_plan_id = sp.id ORDER BY bp.price ASC",
    )) as any[];
    return { plans };
  });

export const createCommercialPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      currency: z.string().default("BRL"),
      billing_interval: z.enum(["day", "week", "month", "year"]).default("month"),
      billing_interval_count: z.number().default(1),
      duration_days: z.number().default(30),
      is_active: z.boolean().default(true),
      subscription_plan_id: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);
    await db.query(
      `INSERT INTO billing_plans (id, name, description, price, currency, billing_interval, billing_interval_count, duration_days, is_active, subscription_plan_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.name,
        input.description || null,
        input.price,
        input.currency,
        input.billing_interval,
        input.billing_interval_count,
        input.duration_days,
        input.is_active,
        input.subscription_plan_id || null,
      ],
    );
    return { success: true };
  });

export const updateCommercialPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      currency: z.string().default("BRL"),
      billing_interval: z.enum(["day", "week", "month", "year"]).default("month"),
      billing_interval_count: z.number().default(1),
      duration_days: z.number().default(30),
      is_active: z.boolean().default(true),
      subscription_plan_id: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);

    // Dynamic warning log if active/existing subscriptions are impacted (warn/info on console)
    console.info(
      `[Commercial Plan Update] Plan ${input.id} details being modified. Linked Operational ID: ${input.subscription_plan_id}`,
    );

    await db.query(
      `UPDATE billing_plans
       SET name = ?, description = ?, price = ?, currency = ?, billing_interval = ?, billing_interval_count = ?, duration_days = ?, is_active = ?, subscription_plan_id = ?
       WHERE id = ?`,
      [
        input.name,
        input.description || null,
        input.price,
        input.currency,
        input.billing_interval,
        input.billing_interval_count,
        input.duration_days,
        input.is_active,
        input.subscription_plan_id || null,
        input.id,
      ],
    );
    return { success: true };
  });

export const deleteCommercialPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context);
    await db.query("DELETE FROM billing_plans WHERE id = ?", [input.id]);
    return { success: true };
  });
