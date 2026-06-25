import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { normalizeToE164 } from "@/lib/phone";

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
    const { data: contact, error: fetchErr } = await context.db
      .from("contacts")
      .select("id, custom_fields")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
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

    const { data: updated, error } = await context.db
      .from("contacts")
      .update({ custom_fields: currentCustomFields })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw error;
    return updated;
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const PAGE = 1000;
    const all: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await context.db
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE)
        .offset(from);
      if (error) throw error;
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
    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");

    const { data: existing } = await context.db
      .from("contacts")
      .select("id, custom_fields")
      .eq("phone_e164", phone)
      .maybeSingle();

    const mergedCustomFields =
      existing?.custom_fields && typeof existing.custom_fields === "object"
        ? { ...(existing.custom_fields as Record<string, any>), ...(data.custom_fields ?? {}) }
        : (data.custom_fields ?? {});

    const { data: row, error } = await context.db
      .from("contacts")
      .upsert(
        {
          user_id: context.userId,
          phone_e164: phone,
          name: data.name || null,
          email: data.email || null,
          custom_fields: mergedCustomFields,
          source: "manual",
        },
        { onConflict: "user_id,phone_e164" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("contacts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
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
    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");

    const { data: row, error } = await context.db
      .from("contacts")
      .update({
        phone_e164: phone,
        name: data.name || null,
        email: data.email || null,
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw error;
    return row;
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
    const cleaned: any[] = [];
    let invalid = 0;
    for (const r of data.rows) {
      const phone = normalizeToE164(r.phone);
      if (!phone) {
        invalid++;
        continue;
      }
      cleaned.push({
        user_id: context.userId,
        phone_e164: phone,
        name: r.name?.toString().slice(0, 120) || null,
        email: r.email?.toString().slice(0, 180) || null,
        custom_fields: r.custom_fields ?? {},
        source: "import",
      });
    }
    if (cleaned.length === 0) return { inserted: 0, invalid };
    // chunk
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const slice = cleaned.slice(i, i + chunkSize);
      const { error } = await context.db
        .from("contacts")
        .upsert(slice, { onConflict: "user_id,phone_e164" });
      if (error) throw error;
      inserted += slice.length;
    }
    return { inserted, invalid };
  });

const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(20000) });

export const bulkDeleteContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => bulkIdsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("contacts").delete().in("id", data.ids);
    if (error) throw error;
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
    const { error } = await context.db
      .from("contacts")
      .update({ opted_out: data.opted_out })
      .in("id", data.ids);
    if (error) throw error;
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
    const rows = data.contact_ids.map((cid) => ({
      list_id: data.list_id,
      contact_id: cid,
      user_id: context.userId,
    }));
    const { error } = await context.db
      .from("list_contacts")
      .upsert(rows, { onConflict: "list_id,contact_id" });
    if (error) throw error;
    return { added: rows.length };
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
    const rows = data.contact_ids.map((cid) => ({
      tag_id: data.tag_id,
      contact_id: cid,
      user_id: context.userId,
    }));
    const { error } = await context.db
      .from("contact_tags")
      .upsert(rows, { onConflict: "tag_id,contact_id" });
    if (error) throw error;
    return { added: rows.length };
  });
