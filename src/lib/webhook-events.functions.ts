import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(data?.limit ?? 100, 1), 500),
  }))
  .handler(async ({ context, data }) => {
    const { data: events, error } = await context.supabase
      .from("webhook_events")
      .select("id, source, processed, received_at, raw")
      .eq("user_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });
