import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { SqlExecutor } from "../mysql.types";
import type { ChannelReadModel, Provider } from "./read-model.types";

export class MySQLChannelConfigReadRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async getById(
    tenantId: string,
    channelConnectionId: string,
  ): Promise<ChannelReadModel | null> {
    const rows = await this.sql.execute<
      {
        id: string;
        tenant_id: string;
        provider: Provider;
        external_account_id: string | null;
        meta_app_connection_id: string | null;
        status: string;
        display_name: string | null;
        access_token_encrypted: string | null;
      }
    >(
      `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, status, display_name, access_token_encrypted
       FROM channel_connections
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [channelConnectionId, tenantId],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      externalAccountId: row.external_account_id,
      metaAppConnectionId: row.meta_app_connection_id,
      status: row.status,
      displayName: row.display_name,
      credentialReference: row.access_token_encrypted
        ? {
            kind: "channel-access-token",
            recordId: row.id,
            tenantId: row.tenant_id,
            provider: row.provider,
          }
        : null,
    };
  }
}
