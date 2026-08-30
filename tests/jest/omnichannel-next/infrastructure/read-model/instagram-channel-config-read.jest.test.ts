import { describe, expect, test } from "@jest/globals";
import { MySQLInstagramChannelConfigReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

const IG_SQL = `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.page_id')) AS page_id, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.ig_user_id')) AS ig_user_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'instagram' LIMIT 1`;

describe("MySQLInstagramChannelConfigReadRepository", () => {
  function buildSql(opts: { pageId?: string | null; igUserId?: string | null } = {}) {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      IG_SQL,
      [{
        id: "ig-1",
        tenant_id: "tenant-a",
        provider: "instagram",
        external_account_id: "IG_123",
        meta_app_connection_id: "meta-1",
        access_token_encrypted: "[ENCRYPTED]",
        page_id: opts.pageId ?? null,
        ig_user_id: opts.igUserId ?? null,
      }],
      ["ig-1", "tenant-a"],
    );
    return sql;
  }

  test("discovers Instagram identifiers without choosing sender", async () => {
    const repo = new MySQLInstagramChannelConfigReadRepository(buildSql({ pageId: "PAGE_X", igUserId: "IG_USER_Y" }));
    const config = await repo.resolve("tenant-a", "ig-1");

    expect(config.channelConnectionId).toBe("ig-1");
    expect(config.externalAccountId).toBe("IG_123");
    expect(config.pageId).toBe("PAGE_X");
    expect(config.instagramUserId).toBe("IG_USER_Y");
    expect(config.credentialReference).toBeDefined();
  });

  test("does not fallback to external_account_id as sender", async () => {
    const repo = new MySQLInstagramChannelConfigReadRepository(buildSql());
    const config = await repo.resolve("tenant-a", "ig-1");

    expect(config.pageId).toBeNull();
    expect(config.instagramUserId).toBeNull();
    // externalAccountId is preserved but not promoted as sender
    expect(config.externalAccountId).toBe("IG_123");
  });
});
