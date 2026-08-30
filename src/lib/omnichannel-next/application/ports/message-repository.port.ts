import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundJobStatus } from "@/lib/omnichannel-next/application/outbox/outbound-job-status";

export interface MessageRecord {
  id: string;
  tenantId: string;
  conversationId: string;
  channelConnectionId: string;
  provider: Provider;
  message: OutboundMessage;
  status: OutboundJobStatus;
  providerMessageId?: string;
}

export interface MessageRepositoryPort {
  createPending(record: Omit<MessageRecord, "status">): Promise<MessageRecord>;
  getById(messageId: string): Promise<MessageRecord | null>;
  markQueued(messageId: string): Promise<MessageRecord>;
  markProcessing(messageId: string): Promise<MessageRecord>;
  markAccepted(messageId: string, providerMessageId: string): Promise<MessageRecord>;
  markFailed(messageId: string): Promise<MessageRecord>;
}
