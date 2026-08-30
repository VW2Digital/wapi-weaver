import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";

export interface ProviderSendContext {
  tenantId: string;
  conversationId: string;
  channelConnectionId: string;
  messageId: string;
  provider?: Provider;
  recipient?: string;
  message: OutboundMessage;
}

export interface ProviderSendResult {
  providerMessageId?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundProviderPort {
  readonly provider: Provider;
  send(context: ProviderSendContext): Promise<ProviderSendResult>;
}
