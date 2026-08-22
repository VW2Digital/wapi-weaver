import { describe, expect, test } from "@jest/globals";
import { buildWebhookEventInsert } from "../../src/lib/webhook-event-store.server";

const input = {
  userId: "tenant-1",
  source: "whatsapp",
  raw: { entry: [{ id: "event-1" }] },
  processed: false,
};

describe("buildWebhookEventInsert", () => {
  test("usa user_id/raw no schema atual", () => {
    const result = buildWebhookEventInsert(
      new Set(["id", "user_id", "source", "raw", "processed", "received_at"]),
      input,
      "row-1",
    );

    expect(result.columns).toEqual(["id", "user_id", "source", "raw", "processed"]);
    expect(result.values).toContain(JSON.stringify(input.raw));
  });

  test("usa tenant_id/payload_json no schema legado", () => {
    const result = buildWebhookEventInsert(
      new Set(["id", "tenant_id", "source", "payload_json", "processed", "created_at"]),
      input,
      "row-2",
    );

    expect(result.columns).toEqual(["id", "tenant_id", "source", "payload_json", "processed"]);
    expect(result.values).toContain("tenant-1");
    expect(result.values).toContain(JSON.stringify(input.raw));
  });
});
