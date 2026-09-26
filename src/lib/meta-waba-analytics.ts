export type MetaBillingCategoryRow = {
  category: string;
  type: string;
  conversations: number;
  cost: number;
};

export type MetaPricingCategoryRow = {
  category: string;
  type: string;
  volume: number;
  cost: number;
};

export type MetaBillingTotals = {
  sent: number;
  delivered: number;
  conversations: number;
  free_conversations: number;
  billable_conversations: number;
  billable_messages: number;
  free_messages: number;
  cost: number;
  cost_available: boolean;
  by_conversation_category: MetaBillingCategoryRow[];
  by_pricing_category: MetaPricingCategoryRow[];
};

export function flattenMetaDataPoints(container: unknown): Record<string, unknown>[] {
  if (!container || typeof container !== "object") return [];
  const obj = container as Record<string, unknown>;
  if (Array.isArray(obj.data_points)) {
    return obj.data_points.filter((p) => p && typeof p === "object") as Record<string, unknown>[];
  }
  if (Array.isArray(obj.data)) {
    return obj.data.flatMap((item) => flattenMetaDataPoints(item));
  }
  return [];
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function keyOf(category: unknown, type: unknown): string {
  return `${String(category || "UNKNOWN").toUpperCase()}::${String(type || "UNKNOWN").toUpperCase()}`;
}

export function aggregateMetaBillingAnalytics(graphBody: {
  analytics?: unknown;
  conversation_analytics?: unknown;
  pricing_analytics?: unknown;
}): MetaBillingTotals {
  const messagePoints = flattenMetaDataPoints(graphBody.analytics);
  let sent = 0;
  let delivered = 0;
  for (const p of messagePoints) {
    sent += num(p.sent);
    delivered += num(p.delivered);
  }

  const convPoints = flattenMetaDataPoints(graphBody.conversation_analytics);
  const convMap = new Map<string, MetaBillingCategoryRow>();
  let conversations = 0;
  let freeConversations = 0;
  let billableConversations = 0;
  let convCost = 0;
  let convCostSeen = false;

  for (const p of convPoints) {
    const category = String(p.conversation_category || "UNKNOWN").toUpperCase();
    const type = String(p.conversation_type || "UNKNOWN").toUpperCase();
    const count = num(p.conversation);
    const cost = num(p.cost);
    if (p.cost !== undefined && p.cost !== null) convCostSeen = true;
    conversations += count;
    convCost += cost;
    if (type === "REGULAR") billableConversations += count;
    if (type === "FREE_TIER" || type === "FREE_ENTRY_POINT") freeConversations += count;
    const key = keyOf(category, type);
    const row = convMap.get(key) ?? { category, type, conversations: 0, cost: 0 };
    row.conversations += count;
    row.cost += cost;
    convMap.set(key, row);
  }

  const pricePoints = flattenMetaDataPoints(graphBody.pricing_analytics);
  const priceMap = new Map<string, MetaPricingCategoryRow>();
  let billableMessages = 0;
  let freeMessages = 0;
  let priceCost = 0;
  let priceCostSeen = false;

  for (const p of pricePoints) {
    const category = String(p.pricing_category || "UNKNOWN").toUpperCase();
    const type = String(p.pricing_type || "UNKNOWN").toUpperCase();
    const volume = num(p.volume);
    const cost = num(p.cost);
    if (p.cost !== undefined && p.cost !== null) priceCostSeen = true;
    priceCost += cost;
    if (type === "REGULAR") billableMessages += volume;
    else freeMessages += volume;
    const key = keyOf(category, type);
    const row = priceMap.get(key) ?? { category, type, volume: 0, cost: 0 };
    row.volume += volume;
    row.cost += cost;
    priceMap.set(key, row);
  }

  const cost = priceCostSeen ? priceCost : convCost;
  const costAvailable = priceCostSeen || convCostSeen;

  return {
    sent,
    delivered,
    conversations,
    free_conversations: freeConversations,
    billable_conversations: billableConversations,
    billable_messages: billableMessages,
    free_messages: freeMessages,
    cost,
    cost_available: costAvailable,
    by_conversation_category: [...convMap.values()].sort((a, b) => b.conversations - a.conversations),
    by_pricing_category: [...priceMap.values()].sort((a, b) => b.volume - a.volume),
  };
}
