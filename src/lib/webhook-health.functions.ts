import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

/**
 * Health-check do webhook do WhatsApp.
 * Admin-only — usa cliente admin para ler `webhook_events` (que tem RLS bloqueada).
 */
export const getWebhookHealth = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // Verificação de admin
    const { data: roles } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado");

    const { dbAdmin } = await import("@/integrations/mysql/client.server");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: last }, { count: total24h }, { count: unprocessed }] = await Promise.all([
      dbAdmin
        .from("webhook_events")
        .select("id, received_at, processed, source")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      dbAdmin
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .gte("received_at", since24h),
      dbAdmin
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

/**
 * Lista os últimos eventos do webhook (admin-only).
 */
export const listWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { limit?: number; onlyUnprocessed?: boolean }) => ({
    limit: Math.min(Math.max(data?.limit ?? 50, 1), 200),
    onlyUnprocessed: !!data?.onlyUnprocessed,
  }))
  .handler(async ({ context, data }) => {
    const { data: roles } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso negado");

    const { dbAdmin } = await import("@/integrations/mysql/client.server");

    let q = dbAdmin
      .from("webhook_events")
      .select("id, source, processed, received_at, raw")
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (data.onlyUnprocessed) q = q.eq("processed", false);

    const { data: events, error } = await q;
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });
