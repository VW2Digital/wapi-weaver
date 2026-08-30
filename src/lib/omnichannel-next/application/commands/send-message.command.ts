import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";

export interface SendMessageCommand {
  tenantId: string;
  actorId?: string;
  messageId?: string;
  conversationId: string;
  recipient?: string;
  message: OutboundMessage;
}
