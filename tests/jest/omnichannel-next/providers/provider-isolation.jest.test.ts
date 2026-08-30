import { describe, expect, test } from "@jest/globals";
import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { ProviderQueueRouter } from "@/lib/omnichannel-next/application/outbox/provider-queue-router";
import { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";
import { NextProviderRegistry, WhatsAppProvider, InstagramProvider } from "@/lib/omnichannel-next/providers";
import { OmnichannelError, UnsupportedProviderError } from "@/lib/omnichannel-next/domain/errors";
import type { Conversation } from "@/lib/omnichannel-next/domain/conversation";
import type { Channel } from "@/lib/omnichannel-next/domain/channel";
import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { ConversationPort } from "@/lib/omnichannel-next/application/ports/conversation.port";
import type { ChannelPort } from "@/lib/omnichannel-next/application/ports/channel.port";
import type { MessageRepositoryPort, MessageRecord } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { TransactionPort } from "@/lib/omnichannel-next/application/ports/transaction.port";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";
import type { ProviderQueuePort } from "@/lib/omnichannel-next/application/outbox/provider-queue.port";
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

  async getById(messageId: string): Promise<MessageRecord | null> {
    return this.records.get(messageId) ?? null;
  }

  async markQueued(messageId: string): Promise<MessageRecord> {
    const record = this.records.get(messageId);
    if (!record) throw new Error("message not found");
    record.status = "queued";
    return record;
  }

  async markProcessing(messageId: string): Promise<MessageRecord> {
    const record = this.records.get(messageId);
    if (!record) throw new Error("message not found");
    record.status = "processing";
    return record;
  }

  async markAccepted(messageId: string, providerMessageId: string): Promise<MessageRecord> {
    const record = this.records.get(messageId);
    if (!record) throw new Error("message not found");
    record.status = "accepted";
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

class FakeProviderQueue implements ProviderQueuePort {
  readonly provider;
  jobs: OutboundJob[] = [];
  shouldThrow = false;

  constructor(provider: "whatsapp" | "instagram") {
    this.provider = provider;
  }

  async enqueue(job: OutboundJob): Promise<void> {
    if (this.shouldThrow) throw new Error(`${this.provider} queue failed`);
    this.jobs.push(job);
  }

  items(): OutboundJob[] {
    return this.jobs;
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

function buildSystem() {
  const waQueue = new FakeProviderQueue("whatsapp");
  const igQueue = new FakeProviderQueue("instagram");
  const router = new ProviderQueueRouter();
  router.register(waQueue);
  router.register(igQueue);

  const conversations = new FakeConversationRepository();
  const channels = new FakeChannelRepository();
  const messages = new FakeMessageRepository();
  const transaction = new NoOpTransaction();
  const sendService = new SendMessageService(conversations, channels, messages, router, transaction);

  const waTransport = new FakeWhatsAppTransport();
  const igTransport = new FakeInstagramTransport();
  const waProvider = new WhatsAppProvider(new FakeWhatsAppConfigPort(), waTransport);
  const igProvider = new InstagramProvider(new FakeInstagramConfigPort(), igTransport);
  const waWorker = new ProviderWorker(waProvider, messages);
  const igWorker = new ProviderWorker(igProvider, messages);

  return {
    conversations,
    channels,
    messages,
    waQueue,
    igQueue,
    router,
    sendService,
    waProvider,
    igProvider,
    waTransport,
    igTransport,
    waWorker,
    igWorker,
  };
}

describe("ProviderQueueRouter", () => {
  test("routes WhatsApp jobs to WhatsApp queue", async () => {
    const { router, waQueue, igQueue } = buildSystem();
    const job: OutboundJob = {
      id: "j1",
      tenantId: TENANT_A,
      messageId: "m1",
      conversationId: waConversation.id,
      channelConnectionId: waChannel.id,
      provider: "whatsapp",
      recipient: "contact-wa-1",
      message: textMessage,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };

    await router.enqueue(job);

    expect(waQueue.jobs).toHaveLength(1);
    expect(igQueue.jobs).toHaveLength(0);
  });

  test("routes Instagram jobs to Instagram queue", async () => {
    const { router, waQueue, igQueue } = buildSystem();
    const job: OutboundJob = {
      id: "j2",
      tenantId: TENANT_A,
      messageId: "m2",
      conversationId: igConversation.id,
      channelConnectionId: igChannel.id,
      provider: "instagram",
      recipient: "contact-ig-1",
      message: textMessage,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };

    await router.enqueue(job);

    expect(waQueue.jobs).toHaveLength(0);
    expect(igQueue.jobs).toHaveLength(1);
  });

  test("unknown provider fails closed", async () => {
    const { router } = buildSystem();
    const job: OutboundJob = {
      id: "j3",
      tenantId: TENANT_A,
      messageId: "m3",
      conversationId: "conv-messenger-1",
      channelConnectionId: "messenger-channel-1",
      provider: "messenger",
      recipient: "contact-messenger-1",
      message: textMessage,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };

    await expect(router.enqueue(job)).rejects.toThrow(UnsupportedProviderError);
  });
});

describe("SendMessageService + ProviderQueueRouter integration", () => {
  test("WA and IG jobs land in the right queue", async () => {
    const { conversations, channels, sendService, waQueue, igQueue } = buildSystem();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await sendService.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });
    await sendService.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    expect(waQueue.jobs).toHaveLength(1);
    expect(igQueue.jobs).toHaveLength(1);
    expect(waQueue.jobs[0].provider).toBe("whatsapp");
    expect(igQueue.jobs[0].provider).toBe("instagram");
    expect(waQueue.jobs[0].message.type).toBe("text");
  });
});

describe("ProviderWorker", () => {
  test("WhatsApp worker processes queued WhatsApp job", async () => {
    const { conversations, channels, sendService, waQueue, waWorker, messages, waTransport } = buildSystem();
    conversations.add(waConversation);
    channels.add(waChannel);

    const result = await sendService.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });

    const job = waQueue.jobs[0];
    const workerResult = await waWorker.process(job);

    expect(workerResult.providerMessageId).toBe("wa-next-1");
    expect(workerResult.status).toBe("accepted");
    expect(waTransport.calls).toHaveLength(1);

    const message = await messages.getById(result.messageId);
    expect(message?.status).toBe("accepted");
    expect(message?.providerMessageId).toBe("wa-next-1");
  });

  test("Instagram worker processes queued Instagram job", async () => {
    const { conversations, channels, sendService, igQueue, igWorker, messages, igTransport } = buildSystem();
    conversations.add(igConversation);
    channels.add(igChannel);

    const result = await sendService.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    const job = igQueue.jobs[0];
    const workerResult = await igWorker.process(job);

    expect(workerResult.providerMessageId).toBe("ig-next-1");
    expect(workerResult.status).toBe("accepted");
    expect(igTransport.calls).toHaveLength(1);

    const message = await messages.getById(result.messageId);
    expect(message?.status).toBe("accepted");
    expect(message?.providerMessageId).toBe("ig-next-1");
  });

  test("worker refuses to process a job from another provider", async () => {
    const { conversations, channels, sendService, igQueue, waWorker } = buildSystem();
    conversations.add(igConversation);
    channels.add(igChannel);

    await sendService.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    const igJob = igQueue.jobs[0];
    await expect(waWorker.process(igJob)).rejects.toThrow(OmnichannelError);
  });

  test("worker is idempotent: calling same job twice only calls provider once", async () => {
    const { conversations, channels, sendService, waQueue, waWorker, waTransport } = buildSystem();
    conversations.add(waConversation);
    channels.add(waChannel);

    await sendService.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });

    const job = waQueue.jobs[0];
    const first = await waWorker.process(job);
    const second = await waWorker.process(job);

    expect(first.providerMessageId).toBe("wa-next-1");
    expect(second.providerMessageId).toBe("wa-next-1");
    expect(waTransport.calls).toHaveLength(1);
  });

  test("worker marks message failed on provider transport failure", async () => {
    const { conversations, channels, sendService, waQueue, waWorker, messages, waTransport } = buildSystem();
    waTransport.shouldThrow = true;
    conversations.add(waConversation);
    channels.add(waChannel);

    const result = await sendService.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });

    const job = waQueue.jobs[0];
    await expect(waWorker.process(job)).rejects.toThrow("WhatsApp transport failed");

    const message = await messages.getById(result.messageId);
    expect(message?.status).toBe("failed");
  });
});

describe("Asynchronous end-to-end flow", () => {
  test("WA → IG → WA full lifecycle", async () => {
    const { conversations, channels, sendService, waQueue, igQueue, waWorker, igWorker } = buildSystem();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    await sendService.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    await sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });

    for (const job of waQueue.jobs) {
      await waWorker.process(job);
    }
    for (const job of igQueue.jobs) {
      await igWorker.process(job);
    }

    expect(waQueue.jobs).toHaveLength(2);
    expect(igQueue.jobs).toHaveLength(1);
  });

  test("IG → WA → IG full lifecycle", async () => {
    const { conversations, channels, sendService, waQueue, igQueue, waWorker, igWorker } = buildSystem();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await sendService.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });
    await sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    await sendService.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });

    for (const job of waQueue.jobs) {
      await waWorker.process(job);
    }
    for (const job of igQueue.jobs) {
      await igWorker.process(job);
    }

    expect(igQueue.jobs).toHaveLength(2);
    expect(waQueue.jobs).toHaveLength(1);
  });

  test("parallel enqueue and parallel process remain isolated", async () => {
    const { conversations, channels, sendService, waQueue, igQueue, waWorker, igWorker } = buildSystem();
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await Promise.all([
      sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
      sendService.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage }),
    ]);

    await Promise.all([
      ...waQueue.jobs.map((job) => waWorker.process(job)),
      ...igQueue.jobs.map((job) => igWorker.process(job)),
    ]);

    expect(waQueue.jobs).toHaveLength(1);
    expect(igQueue.jobs).toHaveLength(1);
  });
});

describe("Queue and worker failure isolation", () => {
  test("WhatsApp queue failure does not affect Instagram enqueue", async () => {
    const { conversations, channels, sendService, waQueue, igQueue } = buildSystem();
    waQueue.shouldThrow = true;
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    await expect(
      sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage }),
    ).rejects.toThrow("whatsapp queue failed");

    await sendService.execute({
      tenantId: TENANT_A,
      conversationId: igConversation.id,
      message: textMessage,
    });

    expect(igQueue.jobs).toHaveLength(1);
  });

  test("WhatsApp worker failure does not affect Instagram worker", async () => {
    const { conversations, channels, sendService, waQueue, igQueue, waWorker, igWorker, waTransport, messages } = buildSystem();
    waTransport.shouldThrow = true;
    conversations.add(waConversation);
    conversations.add(igConversation);
    channels.add(waChannel);
    channels.add(igChannel);

    const waResult = await sendService.execute({ tenantId: TENANT_A, conversationId: waConversation.id, message: textMessage });
    const igResult = await sendService.execute({ tenantId: TENANT_A, conversationId: igConversation.id, message: textMessage });

    await expect(waWorker.process(waQueue.jobs[0])).rejects.toThrow("WhatsApp transport failed");
    const igWorkerResult = await igWorker.process(igQueue.jobs[0]);

    expect(igWorkerResult.status).toBe("accepted");

    const waMessage = await messages.getById(waResult.messageId);
    const igMessage = await messages.getById(igResult.messageId);
    expect(waMessage?.status).toBe("failed");
    expect(igMessage?.status).toBe("accepted");
  });
});

describe("Outbox status lifecycle", () => {
  test("moves from pending → queued → processing → accepted", async () => {
    const { conversations, channels, sendService, waQueue, waWorker, messages } = buildSystem();
    conversations.add(waConversation);
    channels.add(waChannel);

    const result = await sendService.execute({
      tenantId: TENANT_A,
      conversationId: waConversation.id,
      message: textMessage,
    });

    let message = await messages.getById(result.messageId);
    expect(message?.status).toBe("queued");

    await waWorker.process(waQueue.jobs[0]);

    message = await messages.getById(result.messageId);
    expect(message?.status).toBe("accepted");
  });
});

describe("NextProviderRegistry still works", () => {
  test("resolves WhatsApp and Instagram adapters", () => {
    const registry = new NextProviderRegistry();
    const wa = new WhatsAppProvider(new FakeWhatsAppConfigPort(), new FakeWhatsAppTransport());
    const ig = new InstagramProvider(new FakeInstagramConfigPort(), new FakeInstagramTransport());
    registry.register(wa);
    registry.register(ig);

    expect(registry.get("whatsapp").provider).toBe("whatsapp");
    expect(registry.get("instagram").provider).toBe("instagram");
  });
});
