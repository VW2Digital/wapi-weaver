import { describe, expect, test } from "@jest/globals";
import { MySQLConversationRepository } from "@/lib/omnichannel-next/infrastructure/mysql";
import { FakeSqlExecutor } from "./test-fixtures";

const TENANT = "tenant-a";
const CONV = "conv-1";
const CONTACT = "contact-1";
const CHANNEL = "channel-1";

describe("MySQLConversationRepository", () => {
  test("returns a conversation when found", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, contact_id, channel_connection_id FROM chat_sessions WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [{ id: CONV, tenant_id: TENANT, contact_id: CONTACT, channel_connection_id: CHANNEL }],
      [CONV, TENANT],
    );
    const repo = new MySQLConversationRepository(sql);

    const conversation = await repo.getById(TENANT, CONV);

    expect(conversation).not.toBeNull();
    expect(conversation?.id).toBe(CONV);
    expect(conversation?.tenantId).toBe(TENANT);
    expect(conversation?.contactId).toBe(CONTACT);
    expect(conversation?.channelConnectionId).toBe(CHANNEL);
    expect(sql.queries[0].params).toEqual([CONV, TENANT]);
  });

  test("returns null when not found", async () => {
    const sql = new FakeSqlExecutor();
    const repo = new MySQLConversationRepository(sql);

    const conversation = await repo.getById(TENANT, "missing");

    expect(conversation).toBeNull();
    expect(sql.queries[0].sql).toMatch(/chat_sessions/);
  });

  test("query uses id and tenant parameters", async () => {
    const sql = new FakeSqlExecutor();
    const repo = new MySQLConversationRepository(sql);

    await repo.getById(TENANT, CONV);

    expect(sql.queries[0].sql).toMatch(/id = \?/);
    expect(sql.queries[0].sql).toMatch(/tenant_id = \?/);
    expect(sql.queries[0].sql).toMatch(/LIMIT 1/);
    expect(sql.queries[0].params).toEqual([CONV, TENANT]);
  });
});
