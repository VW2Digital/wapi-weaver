import { describe, expect, test } from "@jest/globals";
import { WhatsAppRealDryRun } from "@/lib/omnichannel-next/infrastructure/validation";
import { FakeSqlExecutor } from "../test-fixtures";
import { FixedEncryptionKeyProvider, syntheticEncrypt } from "../security/test-helpers";

const KEY = new FixedEncryptionKeyProvider("test-encryption-key-123");
const WA_SQL = `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted
       FROM channel_connections
       WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp'
       LIMIT 1`;

function buildSql() {
  const sql = new FakeSqlExecutor();
  const token = "WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK";
  const ciphertext = syntheticEncrypt(token, KEY);
  sql.addResult(
    WA_SQL,
    [{
      id: "wa-1",
      tenant_id: "tenant-a",
      provider: "whatsapp",
      external_account_id: "PHONE_123",
      meta_app_connection_id: null,
      access_token_encrypted: ciphertext,
    }],
    ["wa-1", "tenant-a"],
  );
  sql.addResult(
    `SELECT id, tenant_id, provider, access_token_encrypted
         FROM channel_connections
         WHERE id = ? AND tenant_id = ? AND provider = ?
         LIMIT 1`,
    [{
      id: "wa-1",
      tenant_id: "tenant-a",
      provider: "whatsapp",
      access_token_encrypted: ciphertext,
    }],
    ["wa-1", "tenant-a", "whatsapp"],
  );
  return sql;
}

describe("WhatsAppRealDryRun", () => {
  test("passes a full dry run with synthetic encrypted credential", async () => {
    const sql = buildSql();
    const runner = new WhatsAppRealDryRun();
    const result = await runner.run({
      environment: "TEST",
      tenantId: "tenant-a",
      channelConnectionId: "wa-1",
      sql,
      key: KEY.getKey(),
    });

    expect(result.realChannelResolved).toBe(true);
    expect(result.realPhoneNumberIdResolved).toBe(true);
    expect(result.realEncryptedCredentialFound).toBe(true);
    expect(result.realDecryption).toBe("PASS");
    expect(result.realCredentialExposed).toBe(false);
    expect(result.whatsappRequestBuilt).toBe(true);
    expect(result.networkAttempts).toBe(1);
    expect(result.metaRequestsSent).toBe(0);
    expect(result.realMessagesSent).toBe(0);
    expect(result.captured?.authorization).toBe("Bearer [REDACTED]");
    expect(result.captured?.senderNode).toBe("[MASKED]");
    expect(JSON.stringify(result)).not.toContain("WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK");
  });

  test("blocks on unknown environment", async () => {
    const sql = buildSql();
    const runner = new WhatsAppRealDryRun();
    const result = await runner.run({
      environment: "UNKNOWN",
      tenantId: "tenant-a",
      channelConnectionId: "wa-1",
      sql,
      key: KEY.getKey(),
    });

    expect(result.whatsappRequestBuilt).toBe(false);
    expect(result.blockedReason).toBe("BLOCKED_ENVIRONMENT_UNRESOLVED");
    expect(result.networkAttempts).toBe(0);
  });
});
