import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";

export interface MessageRecord {
  id: string;
  tenantId: string;
  conversationId: string;
  channelConnectionId: string;
  provider: Provider;
  message: OutboundMessage;
  status: string;
  providerMessageId?: string;
}

export interface MessageRepositoryPort {
  createPending(record: Omit<MessageRecord, "status">): Promise<MessageRecord>;
  markAccepted(messageId: string, providerMessageId: string): Promise<MessageRecord>;
  markFailed(messageId: string): Promise<MessageRecord>;
}
