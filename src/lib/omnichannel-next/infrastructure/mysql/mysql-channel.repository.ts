import { ChannelNotFoundError } from "@/lib/omnichannel-next/domain/errors";
import type { Channel } from "@/lib/omnichannel-next/domain/channel";
import type { ChannelPort } from "@/lib/omnichannel-next/application/ports/channel.port";
import type { SqlExecutor } from "./mysql.types";

export class MySQLChannelRepository implements ChannelPort {
  constructor(private readonly sql: SqlExecutor) {}

  async getById(
    tenantId: string,
    channelConnectionId: string,
  ): Promise<Channel | null> {
    const rows = await this.sql.execute<
      { id: string; tenant_id: string; provider: string; external_account_id: string; status: string }
    >(
      `SELECT id, tenant_id, provider, external_account_id, status
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
      provider: row.provider as Channel["provider"],
      externalAccountId: row.external_account_id,
      status: row.status as Channel["status"],
    };
  }
}
