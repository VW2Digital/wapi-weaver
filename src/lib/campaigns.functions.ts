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
    return { ok: true };
  });
