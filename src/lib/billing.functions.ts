import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

export const getBillingReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        // ISO yyyy-mm — default: mês corrente
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const now = new Date();
    const month =
      data.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    // Mensagens de campanha (com dados de cobrança detalhados)
    const campaignRows = (await db.query(
      "SELECT status, pricing_billable, pricing_category, conversation_id, conversation_origin, created_at FROM campaign_messages WHERE user_id = ? AND created_at >= ? AND created_at < ?",
      [effectiveUserId, start, end],
    )) as any[];

    // Mensagens de chat direto (também geram custos na API da Meta)
    const directRows = (await db.query(
      "SELECT status, created_at FROM direct_messages WHERE user_id = ? AND direction = 'outgoing' AND created_at >= ? AND created_at < ?",
      [effectiveUserId, start, end],
    )) as any[];

    const totals = {
      total_messages: (campaignRows?.length ?? 0) + (directRows?.length ?? 0),
      campaign_messages: campaignRows?.length ?? 0,
      direct_messages: directRows?.length ?? 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      billable_messages: 0,
      free_messages: 0,
      by_category: {} as Record<string, { messages: number; conversations: number }>,
      unique_conversations: 0,
    };

    const conversationsByCategory = new Map<string, Set<string>>();
    const allConversations = new Set<string>();

    for (const r of campaignRows ?? []) {
      if (r.status === "sent") totals.sent++;
      else if (r.status === "delivered") totals.delivered++;
      else if (r.status === "read") totals.read++;
      else if (r.status === "failed") totals.failed++;

      if (r.pricing_billable === true) totals.billable_messages++;
      else if (r.pricing_billable === false) totals.free_messages++;

      const cat = r.pricing_category ?? "unknown";
      if (!totals.by_category[cat]) totals.by_category[cat] = { messages: 0, conversations: 0 };
      totals.by_category[cat].messages++;

      if (r.conversation_id) {
        allConversations.add(r.conversation_id);
        if (!conversationsByCategory.has(cat)) conversationsByCategory.set(cat, new Set());
        conversationsByCategory.get(cat)!.add(r.conversation_id);
      }
    }

    // Contabilizar mensagens diretas nos totais de status
    for (const r of directRows ?? []) {
      if (r.status === "sent") totals.sent++;
      else if (r.status === "delivered") totals.delivered++;
      else if (r.status === "read") totals.read++;
      else if (r.status === "failed") totals.failed++;
    }

    for (const [cat, set] of conversationsByCategory) {
      totals.by_category[cat].conversations = set.size;
    }
    totals.unique_conversations = allConversations.size;

    return { month, totals };
  });
