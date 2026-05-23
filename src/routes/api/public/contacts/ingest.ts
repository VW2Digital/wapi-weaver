import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeToE164 } from "@/lib/phone";

const schema = z.object({
  phone: z.string().min(8).max(32),
  name: z.string().max(120).optional(),
  email: z.string().email().max(180).optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

// CORS: integrações server-to-server (CRM, n8n, Zapier) não precisam de wildcard.
// Origens permitidas via env CORS_ALLOWED_ORIGINS (separadas por vírgula).
function pickAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const list = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function corsHeaders(request: Request, extra: Record<string, string> = {}) {
  const allow = pickAllowedOrigin(request);
  const h: Record<string, string> = { ...extra };
  if (allow) {
    h["Access-Control-Allow-Origin"] = allow;
    h["Vary"] = "Origin";
  }
  return h;
}

export const Route = createFileRoute("/api/public/contacts/ingest")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          status: 204,
          headers: corsHeaders(request, {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
          }),
        }),
      POST: async ({ request }) => {
        const cors = corsHeaders(request, { "Content-Type": "application/json" });
        const apiKey = request.headers.get("x-api-key");
        if (!apiKey) return new Response(JSON.stringify({ error: "Missing X-API-Key" }), { status: 401, headers: cors });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("api_key", apiKey)
          .maybeSingle();
        if (!profile) return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401, headers: cors });

        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors }); }

        const parsed = schema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: "Validation failed", details: parsed.error.flatten() }), { status: 400, headers: cors });

        const phone = normalizeToE164(parsed.data.phone);
        if (!phone) return new Response(JSON.stringify({ error: "Invalid phone" }), { status: 400, headers: cors });

        const { data: contact, error } = await supabaseAdmin
          .from("contacts")
          .upsert({
            user_id: profile.id,
            phone_e164: phone,
            name: parsed.data.name ?? null,
            email: parsed.data.email ?? null,
            custom_fields: parsed.data.custom_fields ?? {},
            source: "api",
          }, { onConflict: "user_id,phone_e164" })
          .select()
          .single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });

        // tags (optional)
        if (parsed.data.tags?.length) {
          for (const tagName of parsed.data.tags) {
            const { data: tag } = await supabaseAdmin
              .from("tags")
              .upsert({ user_id: profile.id, name: tagName }, { onConflict: "user_id,name" })
              .select()
              .single();
            if (tag) {
              await supabaseAdmin
                .from("contact_tags")
                .upsert({ contact_id: contact.id, tag_id: tag.id, user_id: profile.id });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, contact_id: contact.id }), { status: 200, headers: cors });
      },
    },
  },
});
