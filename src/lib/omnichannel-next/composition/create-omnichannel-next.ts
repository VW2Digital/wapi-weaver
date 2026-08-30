import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { ProviderQueueRouter } from "@/lib/omnichannel-next/application/outbox/provider-queue-router";
import { NextProviderRegistry } from "@/lib/omnichannel-next/providers";
import { WhatsAppProvider } from "@/lib/omnichannel-next/providers/whatsapp";
import { InstagramProvider } from "@/lib/omnichannel-next/providers/instagram";
import {
  MySQLConversationRepository,
  MySQLChannelRepository,
  MySQLMessageRepository,
  MySQLWhatsAppChannelConfigRepository,
  MySQLInstagramChannelConfigRepository,
} from "@/lib/omnichannel-next/infrastructure/mysql";
import { BullMQWhatsAppQueue, BullMQInstagramQueue } from "@/lib/omnichannel-next/infrastructure/bullmq";
import { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";
import { NoOpTransaction } from "./noop-transaction";
import type { OmnichannelNextContainer } from "./omnichannel-next.container";
import type { OmnichannelNextConfig } from "./omnichannel-next.config";

function validateConfig(config: OmnichannelNextConfig): void {
  if (!config.mysql?.executor) {
    throw new OmnichannelError("INVALID_CONFIG", "mysql.executor is required");
  }
  if (!config.queues?.whatsapp) {
    throw new OmnichannelError("INVALID_CONFIG", "queues.whatsapp is required");
  }
  if (!config.queues?.instagram) {
    throw new OmnichannelError("INVALID_CONFIG", "queues.instagram is required");
  }
  if (!config.transports?.whatsapp) {
    throw new OmnichannelError("INVALID_CONFIG", "transports.whatsapp is required");
  }
  if (!config.transports?.instagram) {
    throw new OmnichannelError("INVALID_CONFIG", "transports.instagram is required");
  }
}

export function createOmnichannelNext(config: OmnichannelNextConfig): OmnichannelNextContainer {
  validateConfig(config);

  const conversationRepository = new MySQLConversationRepository(config.mysql.executor);
  const channelRepository = new MySQLChannelRepository(config.mysql.executor);
  const messageRepository = new MySQLMessageRepository(config.mysql.executor);

  const whatsappChannelConfig = new MySQLWhatsAppChannelConfigRepository(config.mysql.executor);
  const instagramChannelConfig = new MySQLInstagramChannelConfigRepository(config.mysql.executor);

  const whatsappQueue = new BullMQWhatsAppQueue(config.queues.whatsapp);
  const instagramQueue = new BullMQInstagramQueue(config.queues.instagram);

  const providerQueueRouter = new ProviderQueueRouter();
  providerQueueRouter.register(whatsappQueue);
  providerQueueRouter.register(instagramQueue);

  const whatsappProvider = new WhatsAppProvider(
    whatsappChannelConfig,
    config.transports.whatsapp,
  );
  const instagramProvider = new InstagramProvider(
    instagramChannelConfig,
    config.transports.instagram,
  );

  const providerRegistry = new NextProviderRegistry();
  providerRegistry.register(whatsappProvider);
  providerRegistry.register(instagramProvider);

  const sendMessageService = new SendMessageService(
    conversationRepository,
    channelRepository,
    messageRepository,
    providerQueueRouter,
    new NoOpTransaction(),
  );

  const whatsappWorker = new ProviderWorker(whatsappProvider, messageRepository);
  const instagramWorker = new ProviderWorker(instagramProvider, messageRepository);

  return {
    sendMessageService,
    conversationRepository,
    channelRepository,
    messageRepository,
    providerRegistry,
    whatsappProvider,
    instagramProvider,
    whatsappQueue,
    instagramQueue,
    whatsappWorker,
    instagramWorker,
  };
}
