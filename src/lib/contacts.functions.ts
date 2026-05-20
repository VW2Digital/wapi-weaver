import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeToE164 } from "@/lib/phone";

const contactInput = z.object({
  phone: z.string().trim().min(8).max(32),
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().max(180).nullable().optional().or(z.literal("")),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  });

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => contactInput.parse(d))
  .handler(async ({ data, context }) => {
    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");
    const { data: row, error } = await context.supabase
      .from("contacts")
      .upsert({
        user_id: context.userId,
        phone_e164: phone,
        name: data.name || null,
        email: data.email || null,
        custom_fields: data.custom_fields ?? {},
        source: "manual",
      }, { onConflict: "user_id,phone_e164" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const bulkInput = z.object({
  rows: z.array(z.object({
    phone: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    custom_fields: z.record(z.string(), z.any()).optional(),
  })).min(1).max(20000),
});

export const bulkUpsertContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bulkInput.parse(d))
  .handler(async ({ data, context }) => {
    const cleaned: any[] = [];
    let invalid = 0;
    for (const r of data.rows) {
      const phone = normalizeToE164(r.phone);
      if (!phone) { invalid++; continue; }
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
      const { error, count } = await context.supabase
        .from("contacts")
        .upsert(slice, { onConflict: "user_id,phone_e164", count: "exact" });
      if (error) throw error;
      inserted += count ?? slice.length;
    }
    return { inserted, invalid };
  });
