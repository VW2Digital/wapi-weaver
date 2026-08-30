import type { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import type { ConversationPort } from "@/lib/omnichannel-next/application/ports/conversation.port";
import type { ChannelPort } from "@/lib/omnichannel-next/application/ports/channel.port";
import type { MessageRepositoryPort } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { ProviderRegistryPort } from "@/lib/omnichannel-next/application/ports/provider-registry.port";
import type { OutboundProviderPort } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { ProviderQueuePort } from "@/lib/omnichannel-next/application/outbox/provider-queue.port";
import type { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";

export interface OmnichannelNextContainer {
  sendMessageService: SendMessageService;

  conversationRepository: ConversationPort;
  channelRepository: ChannelPort;
  messageRepository: MessageRepositoryPort;

  providerRegistry: ProviderRegistryPort;
  whatsappProvider: OutboundProviderPort;
  instagramProvider: OutboundProviderPort;

  whatsappQueue: ProviderQueuePort;
  instagramQueue: ProviderQueuePort;

  whatsappWorker: ProviderWorker;
  instagramWorker: ProviderWorker;
}
