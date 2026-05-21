import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Health-check do webhook do WhatsApp.
 * Admin-only — usa cliente admin para ler `webhook_events` (que tem RLS bloqueada).
 */
export const getWebhookHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verificação de admin
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: last }, { count: total24h }, { count: unprocessed }] = await Promise.all([
      supabaseAdmin
        .from("webhook_events")
        .select("id, received_at, processed, source")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .gte("received_at", since24h),
      supabaseAdmin
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processed", false),
    ]);

    return {
      last_received_at: last?.received_at ?? null,
      last_source: last?.source ?? null,
      last_processed: last?.processed ?? null,
      events_last_24h: total24h ?? 0,
      unprocessed_count: unprocessed ?? 0,
    };
  });
