import { describe, expect, it } from "@jest/globals";
import { aggregateMetaBillingAnalytics } from "../../src/lib/meta-waba-analytics";

describe("aggregateMetaBillingAnalytics", () => {
  it("reads conversation, pricing and message analytics from a Meta WABA payload", () => {
    const totals = aggregateMetaBillingAnalytics({
      analytics: {
        data_points: [
          { sent: 10, delivered: 8 },
          { sent: 5, delivered: 5 },
        ],
      },
      conversation_analytics: {
        data: [
          {
            data_points: [
              {
                conversation: 12,
                conversation_category: "MARKETING",
                conversation_type: "REGULAR",
                cost: 4.5,
              },
              {
                conversation: 3,
                conversation_category: "SERVICE",
                conversation_type: "FREE_ENTRY_POINT",
                cost: 0,
              },
            ],
          },
        ],
      },
      pricing_analytics: {
        data: [
          {
            data_points: [
              {
                volume: 7,
                pricing_category: "MARKETING",
                pricing_type: "REGULAR",
                cost: 9.1,
              },
              {
                volume: 20,
                pricing_category: "SERVICE",
                pricing_type: "FREE_CUSTOMER_SERVICE",
                cost: 0,
              },
            ],
          },
        ],
      },
    });

    expect(totals.sent).toBe(15);
    expect(totals.delivered).toBe(13);
    expect(totals.conversations).toBe(15);
    expect(totals.billable_conversations).toBe(12);
    expect(totals.free_conversations).toBe(3);
    expect(totals.billable_messages).toBe(7);
    expect(totals.free_messages).toBe(20);
    expect(totals.cost).toBe(9.1);
    expect(totals.cost_available).toBe(true);
    expect(totals.by_conversation_category[0]).toMatchObject({
      category: "MARKETING",
      type: "REGULAR",
      conversations: 12,
    });
  });

  it("does not invent local campaign numbers when Meta returns empty analytics", () => {
    const totals = aggregateMetaBillingAnalytics({});
    expect(totals.conversations).toBe(0);
    expect(totals.billable_messages).toBe(0);
    expect(totals.cost_available).toBe(false);
    expect(totals.by_conversation_category).toHaveLength(0);
    expect(totals.by_pricing_category).toHaveLength(0);
    expect(totals.calls_completed).toBe(0);
    expect(totals.call_analytics_available).toBe(false);
  });

  it("reads call_analytics totals without inventing rate cards", () => {
    const totals = aggregateMetaBillingAnalytics({
      call_analytics: {
        data_points: [{ completed: 4, cost: 1.2, average_duration: 30 }],
      },
    });
    expect(totals.calls_completed).toBe(4);
    expect(totals.calls_cost).toBe(1.2);
    expect(totals.calls_avg_duration).toBe(30);
    expect(totals.call_analytics_available).toBe(true);
  });
});
