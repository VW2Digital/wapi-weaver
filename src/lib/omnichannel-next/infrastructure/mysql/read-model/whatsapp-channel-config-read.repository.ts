import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { SqlExecutor } from "../mysql.types";
import type { WhatsAppResolvedChannelConfig } from "./read-model.types";

export class MySQLWhatsAppChannelConfigReadRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async resolve(
    tenantId: string,
    channelConnectionId: string,
  ): Promise<WhatsAppResolvedChannelConfig> {
    const rows = await this.sql.execute<
      {
        id: string;
        tenant_id: string;
        provider: string;
        external_account_id: string | null;
        meta_app_connection_id: string | null;
        access_token_encrypted: string | null;
      }
    >(
      `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted
       FROM channel_connections
       WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp'
       LIMIT 1`,
      [channelConnectionId, tenantId],
    );

    const row = rows[0];
    if (!row) {
      throw new OmnichannelError(
        "WHATSAPP_CHANNEL_NOT_FOUND",
        `WhatsApp channel not found for tenant ${tenantId} and channel ${channelConnectionId}`,
      );
    }

    if (!row.external_account_id) {
      throw new OmnichannelError(
        "WHATSAPP_PHONE_NUMBER_ID_MISSING",
        `WhatsApp channel ${channelConnectionId} has no external_account_id (phone number id)`,
      );
    }

    if (!row.access_token_encrypted) {
      throw new OmnichannelError(
        "WHATSAPP_CREDENTIAL_MISSING",
        `WhatsApp channel ${channelConnectionId} has no credential reference`,
      );
    }

    return {
      channelConnectionId: row.id,
      tenantId: row.tenant_id,
      phoneNumberId: row.external_account_id,
      metaAppConnectionId: row.meta_app_connection_id,
      credentialReference: {
        kind: "channel-access-token",
        recordId: row.id,
        tenantId: row.tenant_id,
        provider: "whatsapp",
      },
    };
  }
}
