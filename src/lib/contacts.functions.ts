import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { normalizeToE164 } from "@/lib/phone";
import crypto from "crypto";

const contactInput = z.object({
  phone: z.string().trim().min(8).max(32),
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().max(180).nullable().optional().or(z.literal("")),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export const updateContactProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid(),
        avatar_url: z.string().trim().max(1000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      "SELECT id, custom_fields FROM contacts WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) throw new Error("Contato não encontrado.");

    const currentCustomFields =
      contact.custom_fields && typeof contact.custom_fields === "object"
        ? { ...(contact.custom_fields as Record<string, any>) }
        : {};

    if (data.avatar_url) {
      currentCustomFields.avatar_url = data.avatar_url;
    } else {
      delete currentCustomFields.avatar_url;
      delete currentCustomFields.photo_url;
      delete currentCustomFields.photo;
      delete currentCustomFields.picture;
      delete currentCustomFields.image_url;
      delete currentCustomFields.image;
    }

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify(currentCustomFields),
      data.id,
    ]);
    const updated = (await db.query("SELECT * FROM contacts WHERE id = ?", [data.id])) as any[];
    return updated?.[0];
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const PAGE = 1000;
    const all: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const data: any[] = (await db.query(
        `SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [effectiveUserId, PAGE, from],
      )) as any[];
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    return all;
  });

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => contactInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");

    return await db.transaction(async (conn) => {
      const [existing]: any = await conn.execute(
        "SELECT id, custom_fields FROM contacts WHERE user_id = ? AND phone_e164 = ? FOR UPDATE",
        [effectiveUserId, phone],
      );

      const mergedCustomFields =
        existing?.[0]?.custom_fields && typeof existing[0].custom_fields === "object"
          ? {
              ...(existing[0].custom_fields as Record<string, any>),
              ...(data.custom_fields ?? {}),
            }
          : (data.custom_fields ?? {});

      const id = existing?.[0]?.id ?? crypto.randomUUID();
      await conn.execute(
        `INSERT INTO contacts (id, user_id, phone_e164, name, email, custom_fields, source)
         VALUES (?, ?, ?, ?, ?, ?, 'manual')
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), custom_fields = VALUES(custom_fields)`,
        [
          id,
          effectiveUserId,
          phone,
          data.name || null,
          data.email || null,
          JSON.stringify(mergedCustomFields),
        ],
      );
      const [rows]: any = await conn.execute("SELECT * FROM contacts WHERE id = ?", [id]);
      return rows[0];
    });
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    return await db.transaction(async (conn) => {
      const [contacts]: any = await conn.execute(
        "SELECT phone_e164 FROM contacts WHERE id = ? AND user_id = ?",
        [data.id, effectiveUserId],
      );
      const contact = contacts?.[0];

      if (contact) {
        await conn.execute(
          "DELETE FROM conversation_assignments WHERE contact_phone = ? AND user_id = ?",
          [contact.phone_e164, effectiveUserId],
        );
        await conn.execute(
          "DELETE FROM conversation_tags WHERE contact_number = ? AND user_id = ?",
          [contact.phone_e164, effectiveUserId],
        );
      }

      await conn.execute("DELETE FROM contacts WHERE id = ? AND user_id = ?", [
        data.id,
        effectiveUserId,
      ]);
      return { ok: true };
    });
  });

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        phone: z.string().trim().min(8).max(32),
        name: z.string().trim().max(120).nullable().optional(),
        email: z.string().email().max(180).nullable().optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");

    await db.query(
      "UPDATE contacts SET phone_e164 = ?, name = ?, email = ? WHERE id = ? AND user_id = ?",
      [phone, data.name || null, data.email || null, data.id, effectiveUserId],
    );
    const rows = await db.query("SELECT * FROM contacts WHERE id = ?", [data.id]);
    return (rows as any[])[0];
  });

const bulkInput = z.object({
  rows: z
    .array(
      z.object({
        phone: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        custom_fields: z.record(z.string(), z.any()).optional(),
      }),
    )
    .min(1)
    .max(20000),
});

export const bulkUpsertContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => bulkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const cleaned: any[] = [];
    let invalid = 0;
    for (const r of data.rows) {
      const phone = normalizeToE164(r.phone);
      if (!phone) {
        invalid++;
        continue;
      }
      cleaned.push({
        id: crypto.randomUUID(),
        user_id: effectiveUserId,
        phone_e164: phone,
        name: r.name?.toString().slice(0, 120) || null,
        email: r.email?.toString().slice(0, 180) || null,
        custom_fields: JSON.stringify(r.custom_fields ?? {}),
        source: "import",
      });
    }
    if (cleaned.length === 0) return { inserted: 0, invalid };
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const slice = cleaned.slice(i, i + chunkSize);
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
      const params = slice.flatMap((r) => [r.id, r.user_id, r.phone_e164, r.name, r.email, r.custom_fields, r.source]);
      await db.query(
        `INSERT INTO contacts (id, user_id, phone_e164, name, email, custom_fields, source)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), custom_fields = VALUES(custom_fields)`,
        params,
      );
      inserted += slice.length;
    }
    return { inserted, invalid };
  });

const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(20000) });

export const bulkDeleteContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => bulkIdsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const placeholders = data.ids.map(() => "?").join(",");
    await db.query(
      `DELETE FROM contacts WHERE id IN (${placeholders}) AND user_id = ?`,
      [...data.ids, effectiveUserId],
    );
    return { deleted: data.ids.length };
  });

export const bulkSetOptOut = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({ ids: z.array(z.string().uuid()).min(1).max(20000), opted_out: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const placeholders = data.ids.map(() => "?").join(",");
    await db.query(
      `UPDATE contacts SET opted_out = ? WHERE id IN (${placeholders}) AND user_id = ?`,
      [data.opted_out ? 1 : 0, ...data.ids, effectiveUserId],
    );
    return { updated: data.ids.length };
  });

export const bulkAddContactsToList = createServerFn({ method: "POST" })
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
    const values = data.contact_ids.map((cid) => [data.list_id, cid, effectiveUserId]);
    const chunkSize = 500;
    let added = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
      await db.query(
        `INSERT IGNORE INTO list_contacts (list_id, contact_id, user_id) VALUES ${placeholders}`,
        chunk.flat(),
      );
      added += chunk.length;
    }
    return { added };
  });

export const bulkAddTagToContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        tag_id: z.string().uuid(),
        contact_ids: z.array(z.string().uuid()).min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const values = data.contact_ids.map((cid) => [data.tag_id, cid, effectiveUserId]);
    const chunkSize = 500;
    let added = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
      await db.query(
        `INSERT IGNORE INTO contact_tags (tag_id, contact_id, user_id) VALUES ${placeholders}`,
        chunk.flat(),
      );
      added += chunk.length;
    }
    return { added };
  });

export const autoFetchContactPhoto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactId: z.string().uuid(),
        phone: z.string().trim().min(8).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const { capturarFotoPerfilLead } = await import("@/lib/profile-photo-scraper");
    const photoUrl = await capturarFotoPerfilLead(data.phone.replace(/\D/g, ""));
    if (!photoUrl) return { photo_url: null };

    const contacts = (await db.query(
      "SELECT id, custom_fields FROM contacts WHERE id = ? AND user_id = ?",
      [data.contactId, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) return { photo_url: null };

    const currentCustomFields =
      contact.custom_fields && typeof contact.custom_fields === "object"
        ? { ...(contact.custom_fields as Record<string, unknown>) }
        : {};

    currentCustomFields.avatar_url = photoUrl;

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify(currentCustomFields),
      data.contactId,
    ]);

    return { photo_url: photoUrl };
  });
