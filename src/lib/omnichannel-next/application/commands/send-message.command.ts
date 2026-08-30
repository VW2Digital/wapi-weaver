import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";

export interface SendMessageCommand {
  tenantId: string;
  actorId?: string;
  conversationId: string;
  message: OutboundMessage;
}
