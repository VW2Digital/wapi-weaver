import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { InstagramChannelConfig } from "@/lib/omnichannel-next/providers/instagram";
import type { InstagramChannelConfigPort } from "@/lib/omnichannel-next/providers/instagram";
import type { SqlExecutor } from "./mysql.types";

export class MySQLInstagramChannelConfigRepository implements InstagramChannelConfigPort {
  constructor(private readonly sql: SqlExecutor) {}

  async resolve(
    tenantId: string,
    channelConnectionId: string,
  ): Promise<InstagramChannelConfig> {
    const rows = await this.sql.execute<
      { id: string; tenant_id: string; external_account_id: string | null; meta_app_connection_id: string | null }
    >(
      `SELECT id, tenant_id, external_account_id, meta_app_connection_id
       FROM channel_connections
       WHERE id = ? AND tenant_id = ? AND provider = 'instagram'
       LIMIT 1`,
      [channelConnectionId, tenantId],
    );

    const row = rows[0];
    if (!row) {
      throw new OmnichannelError(
        "INSTAGRAM_CHANNEL_NOT_FOUND",
        `Instagram channel ${channelConnectionId} not found for tenant ${tenantId}`,
      );
    }

    return {
      channelConnectionId: row.id,
      senderIdentifier: row.external_account_id ?? "",
      credentialReference: row.meta_app_connection_id ?? "",
    };
  }
}
