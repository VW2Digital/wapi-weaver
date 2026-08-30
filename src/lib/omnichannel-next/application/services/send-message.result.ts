import type { Provider } from "@/lib/omnichannel-next/domain/provider";

export interface SendMessageResult {
  messageId: string;
  jobId?: string;
  conversationId: string;
  channelConnectionId: string;
  provider: Provider;
  providerMessageId?: string;
  status: string;
}
