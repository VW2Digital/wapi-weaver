import type { SqlExecutor } from "../mysql.types";
import type { MetaAppReadModel } from "./read-model.types";

export class MySQLMetaAppReadRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getById(
    tenantId: string,
    metaAppConnectionId: string,
  ): Promise<MetaAppReadModel | null> {
    const rows = await this.sql.execute<
      {
        id: string;
        tenant_id: string;
        app_id: string;
        graph_version: string | null;
        status: string;
        app_secret_encrypted: string | null;
        webhook_verify_token_encrypted: string | null;
      }
    >(
      `SELECT id, tenant_id, app_id, graph_version, status,
              app_secret_encrypted, webhook_verify_token_encrypted
       FROM meta_app_connections
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [metaAppConnectionId, tenantId],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      appId: row.app_id,
      graphVersion: row.graph_version,
      status: row.status,
      hasAppSecretEncrypted: Boolean(row.app_secret_encrypted),
      hasWebhookVerifyTokenEncrypted: Boolean(row.webhook_verify_token_encrypted),
    };
  }
}
