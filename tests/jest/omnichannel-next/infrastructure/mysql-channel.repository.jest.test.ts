import { describe, expect, test } from "@jest/globals";
import { MySQLChannelRepository } from "@/lib/omnichannel-next/infrastructure/mysql";
import { FakeSqlExecutor } from "./test-fixtures";

const TENANT = "tenant-a";
const CHANNEL = "channel-1";

describe("MySQLChannelRepository", () => {
  test("returns a channel when found", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, provider, external_account_id, status FROM channel_connections WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [
        {
          id: CHANNEL,
          tenant_id: TENANT,
          provider: "whatsapp",
          external_account_id: "1107720082434785",
          status: "active",
        },
      ],
      [CHANNEL, TENANT],
    );
    const repo = new MySQLChannelRepository(sql);

    const channel = await repo.getById(TENANT, CHANNEL);

    expect(channel).not.toBeNull();
    expect(channel?.id).toBe(CHANNEL);
    expect(channel?.provider).toBe("whatsapp");
    expect(channel?.externalAccountId).toBe("1107720082434785");
    expect(channel?.status).toBe("active");
  });

  test("cross-tenant lookup cannot leak", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, provider, external_account_id, status FROM channel_connections WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [],
      [CHANNEL, TENANT],
    );
    const repo = new MySQLChannelRepository(sql);

    const channel = await repo.getById(TENANT, CHANNEL);
    expect(channel).toBeNull();
    expect(sql.queries[0].params).toEqual([CHANNEL, TENANT]);
  });

  test("does not use provider fallback", async () => {
    const sql = new FakeSqlExecutor();
    const repo = new MySQLChannelRepository(sql);

    await repo.getById(TENANT, CHANNEL);

    expect(sql.queries[0].sql).not.toMatch(/provider\s*=\s*\?/);
    expect(sql.queries[0].sql).not.toMatch(/LIMIT 1\s+ORDER/);
    expect(sql.queries[0].sql).toMatch(/id = \?/);
  });
});
