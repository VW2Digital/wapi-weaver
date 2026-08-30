import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";

export interface OutboundJob {
  id: string;
  tenantId: string;
  messageId: string;
  conversationId: string;
  channelConnectionId: string;
  provider: Provider;
  recipient: string;
  message: OutboundMessage;
  attempt: number;
  createdAt: string;
}
