import { describe, expect, test } from "@jest/globals";
import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { NextProviderRegistry, WhatsAppProvider, InstagramProvider } from "@/lib/omnichannel-next/providers";
import {
  WHATSAPP_CAPABILITIES,
  INSTAGRAM_CAPABILITIES,
} from "@/lib/omnichannel-next/providers";
import { UnsupportedProviderError, ProviderSendError } from "@/lib/omnichannel-next/domain/errors";
import type { Conversation } from "@/lib/omnichannel-next/domain/conversation";
import type { Channel } from "@/lib/omnichannel-next/domain/channel";
import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { ConversationPort } from "@/lib/omnichannel-next/application/ports/conversation.port";
import type { ChannelPort } from "@/lib/omnichannel-next/application/ports/channel.port";
import type { MessageRepositoryPort, MessageRecord } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { TransactionPort } from "@/lib/omnichannel-next/application/ports/transaction.port";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type {
  WhatsAppChannelConfig,
  WhatsAppChannelConfigPort,
  WhatsAppTransportPort,
  WhatsAppTransportRequest,
} from "@/lib/omnichannel-next/providers/whatsapp";
import type {
  InstagramChannelConfig,
  InstagramChannelConfigPort,
  InstagramTransportPort,
  InstagramTransportRequest,
} from "@/lib/omnichannel-next/providers/instagram";

class FakeConversationRepository implements ConversationPort {
  private conversations: Map<string, Conversation> = new Map();

  add(conversation: Conversation): void {
    this.conversations.set(`${conversation.tenantId}:${conversation.id}`, conversation);
  }

  async getById(tenantId: string, conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(`${tenantId}:${conversationId}`) ?? null;
  }
}

class FakeChannelRepository implements ChannelPort {
  private channels: Map<string, Channel> = new Map();

  add(channel: Channel): void {
    this.channels.set(`${channel.tenantId}:${channel.id}`, channel);
  }

  async getById(tenantId: string, channelConnectionId: string): Promise<Channel | null> {
    return this.channels.get(`${tenantId}:${channelConnectionId}`) ?? null;
  }
}

class FakeMessageRepository implements MessageRepositoryPort {
  records: Map<string, MessageRecord> = new Map();

  async createPending(record: Omit<MessageRecord, "status">): Promise<MessageRecord> {
    const full: MessageRecord = { ...record, status: "pending" };
    this.records.set(record.id, full);
    return full;
  }

  async markAccepted(messageId: string, providerMessageId: string): Promise<MessageRecord> {
    const record = this.records.get(messageId);
    if (!record) throw new Error("message not found");
    record.status = "sent";
    record.providerMessageId = providerMessageId;
    return record;
  }

  async markFailed(messageId: string): Promise<MessageRecord> {
    const record = this.records.get(messageId);
    if (!record) throw new Error("message not found");
    record.status = "failed";
    return record;
  }
}

class NoOpTransaction implements TransactionPort {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

class FakeWhatsAppConfigPort implements WhatsAppChannelConfigPort {
  async resolve(): Promise<WhatsAppChannelConfig> {
    return {
      channelConnectionId: "wa-channel-1",
      senderIdentifier: "wa-sender",
      credentialReference: "wa-cred-ref",
    };
  }
}

class FakeInstagramConfigPort implements InstagramChannelConfigPort {
  async resolve(): Promise<InstagramChannelConfig> {
    return {
      channelConnectionId: "ig-channel-1",
      senderIdentifier: "ig-sender",
      credentialReference: "ig-cred-ref",
    };
  }
}

class FakeWhatsAppTransport implements WhatsAppTransportPort {
  calls: WhatsAppTransportRequest[] = [];
  shouldThrow = false;
  private counter = 0;

  async send(request: WhatsAppTransportRequest) {
    this.calls.push(request);
    if (this.shouldThrow) throw new Error("WhatsApp transport failed");
    this.counter++;
    return { providerMessageId: `wa-next-${this.counter}` };
  }
}

class FakeInstagramTransport implements InstagramTransportPort {
  calls: InstagramTransportRequest[] = [];
  shouldThrow = false;
  private counter = 0;

  async send(request: InstagramTransportRequest) {
    this.calls.push(request);
    if (this.shouldThrow) throw new Error("Instagram transport failed");
    this.counter++;
    return { providerMessageId: `ig-next-${this.counter}` };
  }
}

const TENANT_A = "tenant-a";

const waChannel: Channel = {
  id: "wa-channel-1",
  tenantId: TENANT_A,
  provider: "whatsapp",
  externalAccountId: "1107720082434785",
  status: "active",
};

const igChannel: Channel = {
  id: "ig-channel-1",
  tenantId: TENANT_A,
  provider: "instagram",
  externalAccountId: "349476715907213",
  status: "active",
};

const waConversation: Conversation = {
  id: "conv-wa-1",
  tenantId: TENANT_A,
  channelConnectionId: waChannel.id,
  contactId: "contact-wa-1",
};

const igConversation: Conversation = {
  id: "conv-ig-1",
  tenantId: TENANT_A,
  channelConnectionId: igChannel.id,
  contactId: "contact-ig-1",
};

const textMessage: OutboundMessage = { type: "text", text: "oi" };

function buildService() {
  const waTransport = new FakeWhatsAppTransport();
  const igTransport = new FakeInstagramTransport();
  const waProvider = new WhatsAppProvider(new FakeWhatsAppConfigPort(), waTransport);
  const igProvider = new InstagramProvider(new FakeInstagramConfigPort(), igTransport);
  const registry = new NextProviderRegistry();
  registry.register(waProvider);
  registry.register(igProvider);

  const conversations = new FakeConversationRepository();
  const channels = new FakeChannelRepository();
  const messages = new FakeMessageRepository();
  const transaction = new NoOpTransaction();
  const service = new SendMessageService(conversations, channels, messages, registry, transaction);

  return { conversations, channels, service, waTransport, igTransport };
}

describe("NextProviderRegistry", () => {
  test("resolves WhatsApp and Instagram adapters", () => {
    const registry = new NextProviderRegistry();
    const wa = new WhatsAppProvider(new FakeWhatsAppConfigPort(), new FakeWhatsAppTransport());
    const ig = new InstagramProvider(new FakeInstagramConfigPort(), new FakeInstagramTransport());
    registry.register(wa);
    registry.register(ig);

    expect(registry.get("whatsapp").provider).toBe("whatsapp");
    expect(registry.get("instagram").provider).toBe("instagram");
  });

  test("unknown provider fails closed", () => {
    const registry = new NextProviderRegistry();
    expect(() => registry.get("messenger")).toThrow(UnsupportedProviderError);
  });
});

describe("Provider isolation with SendMessageService", () => {
  test("WA and IG keep their own credential references", async () => {
    const { conversations, channels, service, waTransport, igTransport } = buildService();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await service.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });
    await service.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    expect(waTransport.calls[0].credentialReference).toBe("wa-cred-ref");
    expect(igTransport.calls[0].credentialReference).toBe("ig-cred-ref");
  });

  test("WA -> IG -> WA uses correct adapter each time", async () => {
    const { conversations, channels, service, waTransport, igTransport } = buildService();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    const a = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    const b = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    const c = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });

    expect([a.provider, b.provider, c.provider]).toEqual(["whatsapp", "instagram", "whatsapp"]);
    expect(waTransport.calls).toHaveLength(2);
    expect(igTransport.calls).toHaveLength(1);
  });

  test("parallel WA and IG remain isolated", async () => {
    const { conversations, channels, service, waTransport, igTransport } = buildService();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    const [waResult, igResult] = await Promise.all([
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
      service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage }),
    ]);

    expect(waResult.provider).toBe("whatsapp");
    expect(igResult.provider).toBe("instagram");
    expect(waTransport.calls[0].credentialReference).toBe("wa-cred-ref");
    expect(igTransport.calls[0].credentialReference).toBe("ig-cred-ref");
  });

  test("WhatsApp failure does not block Instagram", async () => {
    const { conversations, channels, service, waTransport, igTransport } = buildService();
    waTransport.shouldThrow = true;
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ProviderSendError);

    const result = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    expect(result.provider).toBe("instagram");
    expect(igTransport.calls).toHaveLength(1);
  });

  test("Instagram failure does not block WhatsApp", async () => {
    const { conversations, channels, service, waTransport, igTransport } = buildService();
    igTransport.shouldThrow = true;
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage }),
    ).rejects.toThrow(ProviderSendError);

    const result = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    expect(result.provider).toBe("whatsapp");
    expect(waTransport.calls).toHaveLength(1);
  });

  test("unimplemented media in WhatsApp does not affect Instagram", async () => {
    const { conversations, channels, service, igTransport } = buildService();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      service.execute({
        tenantId: TENANT_A,
        conversationId: waConversation.id,
        message: { type: "image", media: { reference: "img" } },
      }),
    ).rejects.toThrow(ProviderSendError);

    const result = await service.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    expect(result.provider).toBe("instagram");
    expect(igTransport.calls).toHaveLength(1);
  });
});

describe("Provider capabilities isolation", () => {
  test("WhatsApp and Instagram capabilities are independent objects", () => {
    expect(WHATSAPP_CAPABILITIES.image.implemented).toBe(false);
    expect(INSTAGRAM_CAPABILITIES.image.implemented).toBe(false);
    expect(WHATSAPP_CAPABILITIES.document.implemented).toBe(false);
    expect(INSTAGRAM_CAPABILITIES.document.implemented).toBe(false);
    expect(WHATSAPP_CAPABILITIES.text.implemented).toBe(true);
    expect(INSTAGRAM_CAPABILITIES.text.implemented).toBe(true);
  });
});
