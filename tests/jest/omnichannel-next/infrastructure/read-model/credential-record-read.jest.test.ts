import { describe, expect, test } from "@jest/globals";
import { MySQLCredentialRecordReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

describe("MySQLCredentialRecordReadRepository", () => {
  test("finds channel credential reference without plaintext", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, access_token_encrypted, tenant_id, provider FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`,
      [{
        id: "wa-1",
        access_token_encrypted: "[ENCRYPTED]",
        tenant_id: "tenant-a",
        provider: "whatsapp",
      }],
      ["wa-1", "tenant-a", "whatsapp"],
    );
    const repo = new MySQLCredentialRecordReadRepository(sql);
    const record = await repo.findByReference({
      kind: "channel-access-token",
      recordId: "wa-1",
      tenantId: "tenant-a",
      provider: "whatsapp",
    });

    expect(record.exists).toBe(true);
    expect(record.ciphertextPresent).toBe(true);
    expect(JSON.stringify(record)).not.toContain("[ENCRYPTED]");
  });

  test("cross-tenant credential record isolated", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, access_token_encrypted, tenant_id, provider FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`,
      [],
      ["wa-1", "tenant-b", "whatsapp"],
    );
    const repo = new MySQLCredentialRecordReadRepository(sql);
    const record = await repo.findByReference({
      kind: "channel-access-token",
      recordId: "wa-1",
      tenantId: "tenant-b",
      provider: "whatsapp",
    });

    expect(record.exists).toBe(false);
    expect(record.ciphertextPresent).toBe(false);
  });
});
