"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import { hasMasterRole } from "./roles";

/**
 * Ensures platform_banners table exists.
 */
async function ensurePlatformBannersTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS platform_banners (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      cta_label VARCHAR(100) NULL,
      cta_url VARCHAR(500) NULL,
      image_path VARCHAR(500) NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      display_order INT NOT NULL DEFAULT 0,
      created_by VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pb_active_order (is_active, display_order),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

/**
 * Asserts that the authenticated user has the admin_master role.
 * Throws 403 error if the user is not admin_master.
 */
export async function assertMasterCtx(ctx: { userId: string }) {
  const rows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    ctx.userId,
  ])) as Array<{ role: string }>;

  const roles = rows.map(({ role }) => role);
  if (!hasMasterRole(roles)) {
    const err = new Error("Acesso negado: apenas o administrador master (admin_master) da plataforma tem permissão.");
    (err as any).statusCode = 403;
    throw err;
  }
}

/**
 * 1. List active banners for any authenticated user/tenant.
 * Public for all clients to render banners on dashboard.
 */
export const listActiveBanners = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    await ensurePlatformBannersTable();
    const rows = (await db.query(
      `SELECT id, title, subtitle, cta_label, cta_url, image_path, display_order, created_at, updated_at
       FROM platform_banners
       WHERE is_active = true
       ORDER BY display_order ASC, created_at DESC`,
    )) as any[];

    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  });

/**
 * 2. List all banners (active and inactive).
 * EXCLUSIVE to admin_master.
 */
export const listAllBanners = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertMasterCtx(context);
    await ensurePlatformBannersTable();

    const rows = (await db.query(
      `SELECT id, title, subtitle, cta_label, cta_url, image_path, is_active, display_order, created_by, created_at, updated_at
       FROM platform_banners
       ORDER BY display_order ASC, created_at DESC`,
    )) as any[];

    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  });

/**
 * 3. Create a new global banner.
 * EXCLUSIVE to admin_master.
 */
export const createBanner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      title: z.string().min(1, "Título é obrigatório"),
      subtitle: z.string().nullable().optional(),
      cta_label: z.string().nullable().optional(),
      cta_url: z.string().nullable().optional(),
      image_path: z.string().nullable().optional(),
      display_order: z.number().default(0),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertMasterCtx(context);
    await ensurePlatformBannersTable();

    const bannerId = crypto.randomUUID();

    await db.query(
      `INSERT INTO platform_banners (id, title, subtitle, cta_label, cta_url, image_path, is_active, display_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bannerId,
        input.title,
        input.subtitle ?? null,
        input.cta_label ?? null,
        input.cta_url ?? null,
        input.image_path ?? null,
        input.is_active ? 1 : 0,
        input.display_order ?? 0,
        context.userId,
      ],
    );

    return { success: true, id: bannerId };
  });

/**
 * 4. Update an existing global banner.
 * EXCLUSIVE to admin_master.
 */
export const updateBanner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1, "Título é obrigatório"),
      subtitle: z.string().nullable().optional(),
      cta_label: z.string().nullable().optional(),
      cta_url: z.string().nullable().optional(),
      image_path: z.string().nullable().optional(),
      display_order: z.number().default(0),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data: input, context }) => {
    await assertMasterCtx(context);

    await db.query(
      `UPDATE platform_banners
       SET title = ?, subtitle = ?, cta_label = ?, cta_url = ?, image_path = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        input.title,
        input.subtitle ?? null,
        input.cta_label ?? null,
        input.cta_url ?? null,
        input.image_path ?? null,
        input.display_order ?? 0,
        input.is_active ? 1 : 0,
        input.id,
      ],
    );

    return { success: true };
  });

/**
 * 5. Delete a global banner.
 * EXCLUSIVE to admin_master.
 */
export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data: input, context }) => {
    await assertMasterCtx(context);

    await db.query("DELETE FROM platform_banners WHERE id = ?", [input.id]);

    return { success: true };
  });

/**
 * 6. Toggle active status of a banner.
 * EXCLUSIVE to admin_master.
 */
export const toggleBannerActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
  .handler(async ({ data: input, context }) => {
    await assertMasterCtx(context);

    await db.query("UPDATE platform_banners SET is_active = ? WHERE id = ?", [
      input.is_active ? 1 : 0,
      input.id,
    ]);

    return { success: true };
  });
