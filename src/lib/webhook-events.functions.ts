import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

export const listMyWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(data?.limit ?? 100, 1), 500),
  }))
  .handler(async ({ context, data }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const events = (await db.query(
      "SELECT id, source, processed, received_at, raw FROM webhook_events WHERE user_id = ? ORDER BY received_at DESC LIMIT ?",
      [effectiveUserId, data.limit],
    )) as any[];
    return { events: events ?? [] };
  });
