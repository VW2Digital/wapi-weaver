import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

export const listTags = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = await db.query("SELECT * FROM tags WHERE user_id = ? ORDER BY name", [
      effectiveUserId,
    ]);
    return (rows as any[]) ?? [];
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(40),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#25D366"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    await db.query("INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)", [
      id,
      effectiveUserId,
      data.name,
      data.color,
    ]);
    const rows = await db.query("SELECT * FROM tags WHERE id = ?", [id]);
    return (rows as any[])[0];
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM tags WHERE id = ?", [data.id]);
    return { ok: true };
  });

export const listLists = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = await db.query(
      `SELECT l.*, (SELECT COUNT(*) FROM list_contacts lc WHERE lc.list_id = l.id) AS contact_count
       FROM lists l WHERE l.user_id = ? ORDER BY l.created_at DESC`,
      [effectiveUserId],
    );
    return (rows as any[]) ?? [];
  });

export const createList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    await db.query("INSERT INTO lists (id, user_id, name, description) VALUES (?, ?, ?, ?)", [
      id,
      effectiveUserId,
      data.name,
      data.description ?? null,
    ]);
    const rows = await db.query("SELECT * FROM lists WHERE id = ?", [id]);
    return (rows as any[])[0];
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM lists WHERE id = ?", [data.id]);
    return { ok: true };
  });

export const addContactsToList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        list_id: z.string().uuid(),
        contact_ids: z.array(z.string().uuid()).min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = data.contact_ids.map((cid) => [data.list_id, cid, effectiveUserId]);
    const chunkSize = 500;
    let added = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
      await db.query(
        `INSERT INTO list_contacts (list_id, contact_id, user_id) VALUES ${placeholders} ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
        chunk.flat(),
      );
      added += chunk.length;
    }
    return { added };
  });

export const removeContactFromList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ list_id: z.string().uuid(), contact_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM list_contacts WHERE list_id = ? AND contact_id = ?", [
      data.list_id,
      data.contact_id,
    ]);
    return { ok: true };
  });

export const getListContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ list_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const rows = await db.query(
      "SELECT lc.contact_id, c.* FROM list_contacts lc JOIN contacts c ON lc.contact_id = c.id WHERE lc.list_id = ?",
      [data.list_id],
    );
    return (rows as any[]) ?? [];
  });
