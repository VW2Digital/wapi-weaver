import { describe, expect, test } from "@jest/globals";
import { MySQLMetaAppReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

describe("MySQLMetaAppReadRepository", () => {
  test("reads meta app without exposing secrets", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, app_id, graph_version, status, app_secret_encrypted, webhook_verify_token_encrypted FROM meta_app_connections WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [{
        id: "meta-1",
        tenant_id: "tenant-a",
        app_id: "APP_123",
        graph_version: "v26.0",
        status: "active",
        app_secret_encrypted: "[ENCRYPTED_APP_SECRET]",
        webhook_verify_token_encrypted: "[ENCRYPTED_VERIFY_TOKEN]",
      }],
      ["meta-1", "tenant-a"],
    );
    const repo = new MySQLMetaAppReadRepository(sql);
    const app = await repo.getById("tenant-a", "meta-1");

    expect(app).toBeDefined();
    expect(app?.id).toBe("meta-1");
    expect(app?.appId).toBe("APP_123");
    expect(app?.graphVersion).toBe("v26.0");
    expect(app?.hasAppSecretEncrypted).toBe(true);
    expect(app?.hasWebhookVerifyTokenEncrypted).toBe(true);

    const serialized = JSON.stringify(app);
    expect(serialized).not.toContain("[ENCRYPTED_APP_SECRET]");
    expect(serialized).not.toContain("[ENCRYPTED_VERIFY_TOKEN]");
  });

  test("cross-tenant isolation", async () => {
    const sql = new FakeSqlExecutor();
    sql.addResult(
      `SELECT id, tenant_id, app_id, graph_version, status, app_secret_encrypted, webhook_verify_token_encrypted FROM meta_app_connections WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [{
        id: "meta-1",
        tenant_id: "tenant-a",
        app_id: "APP_123",
        graph_version: "v26.0",
        status: "active",
        app_secret_encrypted: null,
        webhook_verify_token_encrypted: null,
      }],
      ["meta-1", "tenant-a"],
    );
    const repo = new MySQLMetaAppReadRepository(sql);
    const app = await repo.getById("tenant-b", "meta-1");

    expect(app).toBeNull();
  });
});
