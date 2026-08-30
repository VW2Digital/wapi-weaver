import { describe, expect, test, beforeEach } from "@jest/globals";
import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { randomUUID } from "node:crypto";
import {
  ConversationNotFoundError,
  ChannelNotFoundError,
  ChannelUnavailableError,
  ChannelConnectionRequiredError,
  UnsupportedProviderError,
  ProviderSendError,
} from "@/lib/omnichannel-next/domain/errors";

import type { Conversation } from "@/lib/omnichannel-next/domain/conversation";
import type { Channel } from "@/lib/omnichannel-next/domain/channel";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { ConversationPort } from "@/lib/omnichannel-next/application/ports/conversation.port";
import type { ChannelPort } from "@/lib/omnichannel-next/application/ports/channel.port";
import type { MessageRepositoryPort, MessageRecord } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { OutboundProviderPort, ProviderSendContext, ProviderSendResult } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { ProviderRegistryPort } from "@/lib/omnichannel-next/application/ports/provider-registry.port";
import type { TransactionPort } from "@/lib/omnichannel-next/application/ports/transaction.port";

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

class FakeProvider implements OutboundProviderPort {
  readonly provider: Provider;
  calls: ProviderSendContext[] = [];
  shouldThrow = false;
  throwOnce = false;
  private counter = 0;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  async send(context: ProviderSendContext): Promise<ProviderSendResult> {
    this.calls.push(context);
    if (this.shouldThrow || (this.throwOnce && this.calls.length === 1)) {
      throw new Error(`Fake ${this.provider} failure`);
    }
    this.counter++;
    return {
      providerMessageId: `${this.provider}-msg-${this.counter}`,
      status: "sent",
    };
  }
}

class FakeProviderRegistry implements ProviderRegistryPort {
  private adapters: Map<Provider, OutboundProviderPort> = new Map();

  register(port: OutboundProviderPort): void {
    this.adapters.set(port.provider, port);
  }

  get(provider: Provider): OutboundProviderPort {
    const port = this.adapters.get(provider);
    if (!port) throw new UnsupportedProviderError(provider);
    return port;
  }
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

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

function createService() {
  const conversations = new FakeConversationRepository();
  const channels = new FakeChannelRepository();
  const messages = new FakeMessageRepository();
  const registry = new FakeProviderRegistry();
  const transaction = new NoOpTransaction();
  const service = new SendMessageService(conversations, channels, messages, registry, transaction);
  return { conversations, channels, messages, registry, transaction, service };
}

describe("SendMessageService — canonical routing", () => {
  test("WhatsApp conversation sends via WhatsApp adapter once", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    registry.register(wa);
    registry.register(ig);
    conversations.add(waConversation);
    channels.add(waChannel);

    const result = await service.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });

    expect(result.provider).toBe("whatsapp");
    expect(result.channelConnectionId).toBe(waChannel.id);
    expect(wa.calls).toHaveLength(1);
    expect(ig.calls).toHaveLength(0);
    expect(result.providerMessageId).toBe("whatsapp-msg-1");
  });

  test("Instagram conversation sends via Instagram adapter once", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    registry.register(wa);
    registry.register(ig);
    conversations.add(igConversation);
    channels.add(igChannel);

    const result = await service.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    expect(result.provider).toBe("instagram");
    expect(ig.calls).toHaveLength(1);
    expect(wa.calls).toHaveLength(0);
    expect(result.providerMessageId).toBe("instagram-msg-1");
  });
});

describe("SendMessageService — sequential", () => {
  test("WA -> IG -> WA", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    registry.register(wa);
    registry.register(ig);
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    const a = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    const b = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    const c = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });

    expect([a.provider, b.provider, c.provider]).toEqual(["whatsapp", "instagram", "whatsapp"]);
    expect(wa.calls).toHaveLength(2);
    expect(ig.calls).toHaveLength(1);
  });

  test("IG -> WA -> IG", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    registry.register(wa);
    registry.register(ig);
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    const a = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    const b = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    const c = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });

    expect([a.provider, b.provider, c.provider]).toEqual(["instagram", "whatsapp", "instagram"]);
  });
});

describe("SendMessageService — parallel", () => {
  test("WhatsApp and Instagram send concurrently without state leakage", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    registry.register(wa);
    registry.register(ig);
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
    expect(wa.calls).toHaveLength(1);
    expect(ig.calls).toHaveLength(1);
  });
});

describe("SendMessageService — failure isolation", () => {
  test("WhatsApp failure does not block Instagram", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    wa.throwOnce = true;
    registry.register(wa);
    registry.register(ig);
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ProviderSendError);

    const result = await service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    expect(result.provider).toBe("instagram");
    expect(ig.calls).toHaveLength(1);
  });

  test("Instagram failure does not block WhatsApp", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    const ig = new FakeProvider("instagram");
    ig.throwOnce = true;
    registry.register(wa);
    registry.register(ig);
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage }),
    ).rejects.toThrow(ProviderSendError);

    const result = await service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    expect(result.provider).toBe("whatsapp");
    expect(wa.calls).toHaveLength(1);
  });
});

describe("SendMessageService — provider safety", () => {
  test("Unknown provider fails closed", async () => {
    const { conversations, channels, registry, service } = createService();
    const messengerConversation: Conversation = {
      id: "conv-messenger-1",
      tenantId: TENANT_A,
      channelConnectionId: "messenger-channel-1",
      contactId: "contact-messenger-1",
    };
    const messengerChannel: Channel = {
      id: "messenger-channel-1",
      tenantId: TENANT_A,
      provider: "messenger",
      externalAccountId: "page-1",
      status: "active",
    };
    conversations.add(messengerConversation);
    channels.add(messengerChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: messengerConversation.id, message: textMessage }),
    ).rejects.toThrow(UnsupportedProviderError);
  });

  test("Wrong provider adapter from registry is rejected", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    // Register a whatsapp adapter under the instagram key to simulate misconfiguration.
    registry.register(wa);
    (registry as any).adapters.set("instagram", wa);
    conversations.add(igConversation);
    channels.add(igChannel);

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage }),
    ).rejects.toThrow(ProviderSendError);
  });
});

describe("SendMessageService — tenant and channel safety", () => {
  test("Conversation tenant mismatch fails", async () => {
    const { conversations, service } = createService();
    conversations.add({ ...waConversation, tenantId: TENANT_B });

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ConversationNotFoundError);
  });

  test("Channel tenant mismatch fails", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    registry.register(wa);
    conversations.add(waConversation);
    channels.add({ ...waChannel, tenantId: TENANT_B });

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ChannelNotFoundError);
  });

  test("Inactive channel fails", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    registry.register(wa);
    conversations.add(waConversation);
    channels.add({ ...waChannel, status: "disconnected" });

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ChannelUnavailableError);
  });

  test("Conversation without channel connection fails", async () => {
    const { conversations, channels, registry, service } = createService();
    const wa = new FakeProvider("whatsapp");
    registry.register(wa);
    conversations.add({ ...waConversation, channelConnectionId: "" });

    await expect(
      service.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow(ChannelConnectionRequiredError);
  });
});
