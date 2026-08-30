import { describe, expect, test } from "@jest/globals";
import { MySQLWhatsAppChannelConfigReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

const WA_SQL = `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp' LIMIT 1`;

describe("MySQLWhatsAppChannelConfigReadRepository", () => {
  function buildSql() {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      WA_SQL,
      [{
        id: "wa-1",
        tenant_id: "tenant-a",
        provider: "whatsapp",
        external_account_id: "PHONE_123",
        meta_app_connection_id: "meta-1",
        access_token_encrypted: "[ENCRYPTED]",
      }],
      ["wa-1", "tenant-a"],
    );
    return sql;
  }

  test("resolves WhatsApp config deterministically", async () => {
    const repo = new MySQLWhatsAppChannelConfigReadRepository(buildSql());
    const config = await repo.resolve("tenant-a", "wa-1");

    expect(config.channelConnectionId).toBe("wa-1");
    expect(config.tenantId).toBe("tenant-a");
    expect(config.phoneNumberId).toBe("PHONE_123");
    expect(config.metaAppConnectionId).toBe("meta-1");
    expect(config.credentialReference.kind).toBe("channel-access-token");
    expect(config.credentialReference.recordId).toBe("wa-1");
  });

  test("maps external_account_id to phoneNumberId semantic", async () => {
    const repo = new MySQLWhatsAppChannelConfigReadRepository(buildSql());
    const config = await repo.resolve("tenant-a", "wa-1");

    expect(config.phoneNumberId).toBe("PHONE_123");
  });

  test("fails closed on missing phone number id", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      WA_SQL,
      [{
        id: "wa-1",
        tenant_id: "tenant-a",
        provider: "whatsapp",
        external_account_id: null,
        meta_app_connection_id: null,
        access_token_encrypted: "[ENCRYPTED]",
      }],
      ["wa-1", "tenant-a"],
    );
    const repo = new MySQLWhatsAppChannelConfigReadRepository(sql);
    await expect(repo.resolve("tenant-a", "wa-1")).rejects.toMatchObject({
      code: "WHATSAPP_PHONE_NUMBER_ID_MISSING",
    });
  });

  test("fails closed on missing credential", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      WA_SQL,
      [{
        id: "wa-1",
        tenant_id: "tenant-a",
        provider: "whatsapp",
        external_account_id: "PHONE_123",
        meta_app_connection_id: null,
        access_token_encrypted: null,
      }],
      ["wa-1", "tenant-a"],
    );
    const repo = new MySQLWhatsAppChannelConfigReadRepository(sql);
    await expect(repo.resolve("tenant-a", "wa-1")).rejects.toMatchObject({
      code: "WHATSAPP_CREDENTIAL_MISSING",
    });
  });

  test("fails closed on wrong tenant", async () => {
    const sql = buildSql();
    const repo = new MySQLWhatsAppChannelConfigReadRepository(sql);
    await expect(repo.resolve("tenant-b", "wa-1")).rejects.toMatchObject({
      code: "WHATSAPP_CHANNEL_NOT_FOUND",
    });
  });

  test("fails closed on wrong provider", async () => {
    const sql = buildSql();
    const repo = new MySQLWhatsAppChannelConfigReadRepository(sql);
    await expect(repo.resolve("tenant-a", "ig-1")).rejects.toMatchObject({
      code: "WHATSAPP_CHANNEL_NOT_FOUND",
    });
  });
});
