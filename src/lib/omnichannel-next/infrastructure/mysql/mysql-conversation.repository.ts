import { ConversationNotFoundError } from "@/lib/omnichannel-next/domain/errors";
import type { Conversation } from "@/lib/omnichannel-next/domain/conversation";
import type { ConversationPort } from "@/lib/omnichannel-next/application/ports/conversation.port";
import type { SqlExecutor } from "./mysql.types";

export class MySQLConversationRepository implements ConversationPort {
  constructor(private readonly sql: SqlExecutor) {}

  async getById(tenantId: string, conversationId: string): Promise<Conversation | null> {
    const rows = await this.sql.execute<
      { id: string; tenant_id: string; contact_id: string; channel_connection_id: string }
    >(
      `SELECT id, tenant_id, contact_id, channel_connection_id
       FROM chat_sessions
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [conversationId, tenantId],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      channelConnectionId: row.channel_connection_id,
    };
  }
}
