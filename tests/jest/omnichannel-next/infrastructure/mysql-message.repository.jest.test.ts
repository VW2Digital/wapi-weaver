import { describe, expect, test } from "@jest/globals";
import { MySQLMessageRepository } from "@/lib/omnichannel-next/infrastructure/mysql";
import { FakeSqlExecutor } from "./test-fixtures";

const MID = "msg-1";
const TENANT = "tenant-a";
const CONV = "conv-1";
const CHANNEL = "channel-1";

describe("MySQLMessageRepository", () => {
  function makeRecord() {
    return {
      id: MID,
      tenantId: TENANT,
      conversationId: CONV,
      channelConnectionId: CHANNEL,
      provider: "whatsapp" as const,
      message: { type: "text" as const, text: "oi" },
    };
  }

  test("createPending inserts outbox row with safe payload", async () => {
    const sql = new FakeSqlExecutor();
    const repo = new MySQLMessageRepository(sql);

    await repo.createPending(makeRecord());

    const query = sql.queries[1];
    expect(query.sql).toMatch(/INSERT INTO chat_message_outbox/);
    expect(query.params).toContain(MID);
    expect(query.params).toContain(TENANT);
    expect(query.params).toContain("whatsapp");

    const payload = query.params.find((p) => typeof p === "string" && p.includes("conversationId"));
    expect(typeof payload).toBe("string");
    expect(JSON.parse(payload as string)).toEqual({
      conversationId: CONV,
      channelConnectionId: CHANNEL,
      message: { type: "text", text: "oi" },
    });
  });

  test("getById reconstructs record from outbox payload", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`,
      [
        {
          id: MID,
          tenant_id: TENANT,
          message_id: MID,
          channel: "whatsapp",
          status: "sent",
          provider_message_id: "wa-123",
          payload: JSON.stringify({
            conversationId: CONV,
            channelConnectionId: CHANNEL,
            message: { type: "text", text: "oi" },
          }),
          attempts: 1,
        },
      ],
      [MID],
    );
    const repo = new MySQLMessageRepository(sql);

    const record = await repo.getById(MID);

    expect(record).not.toBeNull();
    expect(record?.id).toBe(MID);
    expect(record?.status).toBe("accepted");
    expect(record?.providerMessageId).toBe("wa-123");
    expect(record?.message).toEqual({ type: "text", text: "oi" });
    expect(sql.queries[0].params).toEqual([MID]);
  });

  test("status methods are parameterized", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`,
      [
        {
          id: MID,
          tenant_id: TENANT,
          message_id: MID,
          channel: "whatsapp",
          status: "sent",
          provider_message_id: "wa-123",
          payload: JSON.stringify({
            conversationId: CONV,
            channelConnectionId: CHANNEL,
            message: { type: "text", text: "oi" },
          }),
          attempts: 1,
        },
      ],
      [MID],
    );
    const repo = new MySQLMessageRepository(sql);

    await repo.markQueued(MID);
    await repo.markProcessing(MID);
    await repo.markAccepted(MID, "wa-456");
    await repo.markFailed(MID);

    const updates = sql.queries.filter((q) => q.sql.includes("UPDATE chat_message_outbox"));
    expect(updates.length).toBeGreaterThanOrEqual(4);
    for (const q of updates) {
      expect(q.params[q.params.length - 1]).toBe(MID);
    }
  });

  test("payload does not contain credentials", async () => {
    const sql = new FakeSqlExecutor();
    const repo = new MySQLMessageRepository(sql);

    await repo.createPending(makeRecord());

    const payload = sql.queries[1].params.find((p) => typeof p === "string" && p.includes("conversationId")) as string;
    const json = JSON.parse(payload);
    expect(json).not.toHaveProperty("accessToken");
    expect(json).not.toHaveProperty("appSecret");
    expect(json).not.toHaveProperty("verifyToken");
    expect(json).not.toHaveProperty("encryptionKey");
  });
});
