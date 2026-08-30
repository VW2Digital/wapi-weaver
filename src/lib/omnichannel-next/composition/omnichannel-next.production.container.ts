import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { MySQLConversationRepository } from "@/lib/omnichannel-next/infrastructure/mysql/mysql-conversation.repository";
import { MySQLChannelRepository } from "@/lib/omnichannel-next/infrastructure/mysql/mysql-channel.repository";
import { MySQLMessageRepository } from "@/lib/omnichannel-next/infrastructure/mysql/mysql-message.repository";
import { MySQLWhatsAppChannelConfigAdapter } from "@/lib/omnichannel-next/infrastructure/mysql/read-model/whatsapp-channel-config-adapter";
import { MySQLEncryptedCredentialRepository } from "@/lib/omnichannel-next/infrastructure/security";
import { AesGcmCredentialDecryptor } from "@/lib/omnichannel-next/infrastructure/security";
import { EnvMetaEncryptionKeyProvider } from "@/lib/omnichannel-next/infrastructure/security";
import { SecureCredentialVault } from "@/lib/omnichannel-next/infrastructure/security";
import { WhatsAppCredentialResolver } from "@/lib/omnichannel-next/infrastructure/security";
import { WhatsAppProvider } from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.provider";
import { MetaWhatsAppTransport } from "@/lib/omnichannel-next/infrastructure/meta/whatsapp";
import { BullMQWhatsAppQueue } from "@/lib/omnichannel-next/infrastructure/bullmq";
import { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";
import { NoOpTransaction } from "@/lib/omnichannel-next/infrastructure/transaction/no-op-transaction";
import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";
import type { HttpClientPort } from "@/lib/omnichannel-next/infrastructure/http";
import type { OmnichannelNextContainer } from "./omnichannel-next.container";

interface MinimalBullMQQueue {
  add: (name: string, data: unknown, opts?: { jobId?: string }) => Promise<unknown>;
}

export function buildOmnichannelNextProductionContainer(
  sql: SqlExecutor,
  http: HttpClientPort,
  queue: MinimalBullMQQueue,
  graphApiVersion = "25.0",
): OmnichannelNextContainer {
  const conversationRepository = new MySQLConversationRepository(sql);
  const channelRepository = new MySQLChannelRepository(sql);
  const messageRepository = new MySQLMessageRepository(sql);

  const keyProvider = new EnvMetaEncryptionKeyProvider();
  const credentialRepository = new MySQLEncryptedCredentialRepository(sql);
  const vault = new SecureCredentialVault(credentialRepository, new AesGcmCredentialDecryptor(keyProvider));
  const credentialResolver = new WhatsAppCredentialResolver(vault);
  const configRepository = new MySQLWhatsAppChannelConfigAdapter(sql);

  const transport = new MetaWhatsAppTransport({ graphApiVersion }, http, credentialResolver);
  const whatsappProvider = new WhatsAppProvider(configRepository, transport);

  const whatsappQueue = new BullMQWhatsAppQueue(queue);
  const whatsappWorker = new ProviderWorker(whatsappProvider, messageRepository);
  const instagramWorker = new ProviderWorker(
    { provider: "instagram", send: async () => { throw new Error("Instagram Next is not activated"); } } as any,
    messageRepository,
  );

  const sendMessageService = new SendMessageService(
    conversationRepository,
    channelRepository,
    messageRepository,
    whatsappQueue,
    new NoOpTransaction(),
  );

  const providerRegistry = {
    get: (provider: string) => {
      if (provider === "whatsapp") return whatsappProvider;
      throw new Error(`Provider ${provider} not configured`);
    },
  } as unknown as OmnichannelNextContainer["providerRegistry"];

  return {
    sendMessageService,
    conversationRepository,
    channelRepository,
    messageRepository,
    providerRegistry,
    whatsappProvider,
    instagramProvider: { provider: "instagram" } as unknown as OmnichannelNextContainer["instagramProvider"],
    whatsappQueue,
    instagramQueue: { provider: "instagram" } as unknown as OmnichannelNextContainer["instagramQueue"],
    whatsappWorker,
    instagramWorker,
  } as unknown as OmnichannelNextContainer;
}
