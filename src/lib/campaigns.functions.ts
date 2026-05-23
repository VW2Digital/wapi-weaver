import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAudit } from "./audit.functions";

const payloadSchema = z.object({
  // For template messages
  template_name: z.string().optional(),
  language: z.string().optional(),
  variables: z.array(z.string()).optional(), // body variables in order
  header_image_url: z.string().url().optional(),
  // For text/media
  text: z.string().max(4096).optional(),
  media_type: z.enum(["image", "document", "video"]).optional(),
  media_url: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(200).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  message_type: z.enum(["template", "text", "media", "interactive"]),
  template_id: z.string().uuid().nullable().optional(),
  list_id: z.string().uuid(),
  payload: payloadSchema,
  scheduled_at: z.string().datetime().nullable().optional(),
  start_now: z.boolean().default(true),
});

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: campaign, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { data: messages } = await context.supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(500);
    return { campaign, messages: messages ?? [] };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Fetch contacts from list
    const { data: lcRows, error: lcErr } = await context.supabase
      .from("list_contacts")
      .select("contact_id, contacts(id, phone_e164, opted_out)")
      .eq("list_id", data.list_id);
    if (lcErr) throw lcErr;
    const contacts = (lcRows ?? [])
      .map((r: any) => r.contacts)
      .filter((c: any) => c && !c.opted_out);
    if (contacts.length === 0) throw new Error("Lista sem contatos válidos");

    const status = data.start_now ? "queued" : "draft";
    const { data: campaign, error } = await context.supabase
      .from("campaigns")
      .insert({
        user_id: context.userId,
        name: data.name,
        message_type: data.message_type,
        template_id: data.template_id ?? null,
        list_id: data.list_id,
        payload: data.payload,
        scheduled_at: data.scheduled_at ?? null,
        status,
        totals: { total: contacts.length, pending: contacts.length, sent: 0, delivered: 0, read: 0, failed: 0 },
      })
      .select()
      .single();
    if (error) throw error;

    // Create queue rows in chunks
    const chunkSize = 500;
    for (let i = 0; i < contacts.length; i += chunkSize) {
      const slice = contacts.slice(i, i + chunkSize).map((c: any) => ({
        user_id: context.userId,
        campaign_id: campaign.id,
        contact_id: c.id,
        to_phone: c.phone_e164,
        status: "pending" as const,
      }));
      const { error: insErr } = await context.supabase.from("campaign_messages").insert(slice);
      if (insErr) throw insErr;
    }

    await recordAudit({
      userId: context.userId,
      action: "campaign.create",
      entityType: "campaign",
      entityId: campaign.id,
      metadata: { name: data.name, total: contacts.length, message_type: data.message_type },
    });

    return { campaign, queued: contacts.length };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      action: "campaign.cancel",
      entityType: "campaign",
      entityId: data.id,
    });
    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("campaigns")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error: mErr } = await context.supabase
      .from("campaign_messages")
      .delete()
      .eq("campaign_id", data.id);
    if (mErr) throw mErr;
    const { error } = await context.supabase
      .from("campaigns")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      action: "campaign.delete",
      entityType: "campaign",
      entityId: data.id,
      metadata: { name: c?.name },
    });
    return { ok: true };
  });

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const exportCampaignReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: campaign, error: cErr } = await context.supabase
      .from("campaigns")
      .select("id, name, created_at, status")
      .eq("id", data.id)
      .single();
    if (cErr) throw cErr;

    // Busca em páginas (Supabase limita a 1000)
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data: rows, error } = await context.supabase
        .from("campaign_messages")
        .select("to_phone, status, attempts, wa_message_id, sent_at, delivered_at, read_at, failed_at, error, contact_id, contacts(name, email)")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    const header = [
      "telefone",
      "nome",
      "email",
      "status",
      "tentativas",
      "wa_message_id",
      "enviado_em",
      "entregue_em",
      "lido_em",
      "falhou_em",
      "erro",
    ];
    const lines = [header.join(",")];
    for (const r of all) {
      const contact = (r as any).contacts ?? {};
      lines.push([
        csvEscape(r.to_phone),
        csvEscape(contact.name),
        csvEscape(contact.email),
        csvEscape(r.status),
        csvEscape(r.attempts),
        csvEscape(r.wa_message_id),
        csvEscape(r.sent_at),
        csvEscape(r.delivered_at),
        csvEscape(r.read_at),
        csvEscape(r.failed_at),
        csvEscape(r.error),
      ].join(","));
    }

    await recordAudit({
      userId: context.userId,
      action: "campaign.export",
      entityType: "campaign",
      entityId: data.id,
      metadata: { rows: all.length },
    });

    return {
      filename: `campanha-${campaign.name.replace(/[^\w-]+/g, "_")}-${campaign.id.slice(0, 8)}.csv`,
      csv: lines.join("\n"),
      rows: all.length,
    };
  });
