import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { SqlExecutor } from "../mysql.types";
import type { InstagramChannelIdentityReadModel } from "./read-model.types";

export class MySQLInstagramChannelConfigReadRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async resolve(
    tenantId: string,
    channelConnectionId: string,
  ): Promise<InstagramChannelIdentityReadModel> {
    const rows = await this.sql.execute<
      {
        id: string;
        tenant_id: string;
        provider: string;
        external_account_id: string | null;
        meta_app_connection_id: string | null;
        access_token_encrypted: string | null;
        page_id: string | null;
        ig_user_id: string | null;
      }
    >(
      `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.page_id')) AS page_id,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.ig_user_id')) AS ig_user_id
       FROM channel_connections
       WHERE id = ? AND tenant_id = ? AND provider = 'instagram'
       LIMIT 1`,
      [channelConnectionId, tenantId],
    );

    const row = rows[0];
    if (!row) {
      throw new OmnichannelError(
        "INSTAGRAM_CHANNEL_NOT_FOUND",
        `Instagram channel not found for tenant ${tenantId} and channel ${channelConnectionId}`,
      );
    }

    return {
      channelConnectionId: row.id,
      tenantId: row.tenant_id,
      externalAccountId: row.external_account_id,
      pageId: row.page_id ?? null,
      instagramUserId: row.ig_user_id ?? null,
      metaAppConnectionId: row.meta_app_connection_id,
      credentialReference: row.access_token_encrypted
        ? {
            kind: "channel-access-token",
            recordId: row.id,
            tenantId: row.tenant_id,
            provider: "instagram",
          }
        : null,
    };
  }
}
