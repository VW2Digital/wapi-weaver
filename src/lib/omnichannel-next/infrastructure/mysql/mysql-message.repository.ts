import { ConversationNotFoundError, OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { MessageRepositoryPort, MessageRecord } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { OutboundJobStatus } from "@/lib/omnichannel-next/application/outbox/outbound-job-status";
import type { SqlExecutor } from "./mysql.types";

interface OutboxRow {
  id: string;
  tenant_id: string;
  message_id: string;
  channel: string;
  status: "pending" | "processing" | "retry" | "sent" | "failed";
  provider_message_id: string | null;
  payload: string;
  attempts: number;
}

const NEXT_TO_OUTBOX: Record<OutboundJobStatus, OutboxRow["status"]> = {
  pending: "pending",
  queued: "pending",
  processing: "processing",
  accepted: "sent",
  failed: "failed",
};

const OUTBOX_TO_NEXT: Record<OutboxRow["status"], OutboundJobStatus> = {
  pending: "pending",
  processing: "processing",
  retry: "failed",
  sent: "accepted",
  failed: "failed",
};

export class MySQLMessageRepository implements MessageRepositoryPort {
  constructor(private readonly sql: SqlExecutor) {}

  async createPending(
    record: Omit<MessageRecord, "status">,
  ): Promise<MessageRecord> {
    const payload = JSON.stringify({
      conversationId: record.conversationId,
      channelConnectionId: record.channelConnectionId,
      message: record.message,
    });

    await this.sql.execute(
      `INSERT INTO chat_message_outbox
       (id, tenant_id, user_id, message_id, channel, recipient, provider_account_id, payload, status,
        attempts, max_attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        record.id,
        record.tenantId,
        record.tenantId,
        record.id,
        record.provider,
        "unknown",
        "",
        payload,
        NEXT_TO_OUTBOX["pending"],
        0,
        5,
      ],
    );

    return { ...record, status: "pending" };
  }

  async getById(messageId: string): Promise<MessageRecord | null> {
    const rows = await this.sql.execute<OutboxRow>(
      `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts
       FROM chat_message_outbox
       WHERE id = ?
       LIMIT 1`,
      [messageId],
    );

    const row = rows[0];
    if (!row) return null;

    const payload = JSON.parse(row.payload) as {
      conversationId: string;
      channelConnectionId: string;
      message: OutboundMessage;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: payload.conversationId,
      channelConnectionId: payload.channelConnectionId,
      provider: row.channel as Provider,
      message: payload.message,
      status: OUTBOX_TO_NEXT[row.status],
      providerMessageId: row.provider_message_id ?? undefined,
    };
  }

  async markQueued(messageId: string): Promise<MessageRecord> {
    return this.updateStatus(messageId, "queued");
  }

  async markProcessing(messageId: string): Promise<MessageRecord> {
    return this.updateStatus(messageId, "processing");
  }

  async markAccepted(
    messageId: string,
    providerMessageId: string,
  ): Promise<MessageRecord> {
    await this.sql.execute(
      `UPDATE chat_message_outbox
       SET status = ?, provider_message_id = ?, attempts = attempts + 1
       WHERE id = ?`,
      [NEXT_TO_OUTBOX["accepted"], providerMessageId, messageId],
    );
    const record = await this.getById(messageId);
    if (!record) throw new ConversationNotFoundError(messageId);
    return record;
  }

  async markFailed(messageId: string): Promise<MessageRecord> {
    return this.updateStatus(messageId, "failed");
  }

  private async updateStatus(
    messageId: string,
    status: OutboundJobStatus,
  ): Promise<MessageRecord> {
    await this.sql.execute(
      `UPDATE chat_message_outbox
       SET status = ?, attempts = attempts + 1
       WHERE id = ?`,
      [NEXT_TO_OUTBOX[status], messageId],
    );
    const record = await this.getById(messageId);
    if (!record) throw new OmnichannelError("MESSAGE_NOT_FOUND", `message ${messageId} not found`);
    return record;
  }
}
