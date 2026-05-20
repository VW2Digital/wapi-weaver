import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";

const credSchema = z.object({
  whatsapp_phone_number_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_waba_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_phone: z.string().trim().max(32).nullable().optional(),
  whatsapp_access_token: z.string().trim().max(1024).nullable().optional(),
  whatsapp_app_secret: z.string().trim().max(256).nullable().optional(),
  whatsapp_verify_token: z.string().trim().max(128).nullable().optional(),
  rate_limit_per_second: z.number().int().min(1).max(80).optional(),
  display_name: z.string().trim().max(100).optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const rotateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const newKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await context.supabase
      .from("profiles")
      .update({ api_key: newKey })
      .eq("id", context.userId);
    if (error) throw error;
    return { api_key: newKey };
  });

export const pingMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const r = await fetch(`https://graph.facebook.com/v20.0/${p.whatsapp_phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
    });
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao consultar Meta" };
    return { ok: true, info: body };
  });
