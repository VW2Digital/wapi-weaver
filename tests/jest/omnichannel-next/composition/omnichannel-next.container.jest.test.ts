import { describe, expect, test } from "@jest/globals";
import { createOmnichannelNext } from "@/lib/omnichannel-next/composition";
import { FakeSqlExecutor, FakeBullMQQueue } from "../infrastructure/test-fixtures";
import { FakeWhatsAppTransport, FakeInstagramTransport } from "./test-fakes";

const TENANT = "tenant-a";
const WA_CONV = "conv-wa-1";
const IG_CONV = "conv-ig-1";
const WA_CHANNEL = "channel-wa-1";
const IG_CHANNEL = "channel-ig-1";
const WA_CONTACT = "contact-wa-1";
const IG_CONTACT = "contact-ig-1";

const conversationSql = `SELECT id, tenant_id, contact_id, channel_connection_id FROM chat_sessions WHERE id = ? AND tenant_id = ? LIMIT 1`;
const channelSql = `SELECT id, tenant_id, provider, external_account_id, status FROM channel_connections WHERE id = ? AND tenant_id = ? LIMIT 1`;
const waConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp' LIMIT 1`;
const igConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'instagram' LIMIT 1`;
const outboxSql = `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`;

function buildSql() {
  const sql = new FakeSqlExecutor();

  sql.addResult(conversationSql, [
    { id: WA_CONV, tenant_id: TENANT, contact_id: WA_CONTACT, channel_connection_id: WA_CHANNEL },
  ], [WA_CONV, TENANT]);
  sql.addResult(conversationSql, [
    { id: IG_CONV, tenant_id: TENANT, contact_id: IG_CONTACT, channel_connection_id: IG_CHANNEL },
  ], [IG_CONV, TENANT]);

  sql.addResult(channelSql, [
    { id: WA_CHANNEL, tenant_id: TENANT, provider: "whatsapp", external_account_id: "1107720082434785", status: "active" },
  ], [WA_CHANNEL, TENANT]);
  sql.addResult(channelSql, [
    { id: IG_CHANNEL, tenant_id: TENANT, provider: "instagram", external_account_id: "349476715907213", status: "active" },
  ], [IG_CHANNEL, TENANT]);

  sql.addResult(waConfigSql, [
    { id: WA_CHANNEL, tenant_id: TENANT, external_account_id: "1107720082434785", meta_app_connection_id: "meta-app-wa-1" },
  ], [WA_CHANNEL, TENANT]);
  sql.addResult(igConfigSql, [
    { id: IG_CHANNEL, tenant_id: TENANT, external_account_id: "349476715907213", meta_app_connection_id: "meta-app-ig-1" },
  ], [IG_CHANNEL, TENANT]);

  sql.setDefault(/chat_message_outbox/, [
    {
      id: "msg-default",
      tenant_id: TENANT,
      message_id: "msg-default",
      channel: "whatsapp",
      status: "sent",
      provider_message_id: "wa-123",
      payload: JSON.stringify({
        conversationId: WA_CONV,
        channelConnectionId: WA_CHANNEL,
        message: { type: "text", text: "oi" },
      }),
      attempts: 1,
    },
  ]);

  return sql;
}

function buildConfig() {
  const sql = buildSql();
  const waQueue = new FakeBullMQQueue();
  const igQueue = new FakeBullMQQueue();
  const waTransport = new FakeWhatsAppTransport();
  const igTransport = new FakeInstagramTransport();

  return {
    sql,
    waQueue,
    igQueue,
    waTransport,
    igTransport,
    config: {
      mysql: { executor: sql },
      queues: { whatsapp: waQueue, instagram: igQueue },
      transports: { whatsapp: waTransport, instagram: igTransport },
    },
  };
}

describe("createOmnichannelNext", () => {
  test("creates a container with all dependencies", () => {
    const { config } = buildConfig();
    const container = createOmnichannelNext(config);

    expect(container.sendMessageService).toBeDefined();
    expect(container.conversationRepository).toBeDefined();
    expect(container.channelRepository).toBeDefined();
    expect(container.messageRepository).toBeDefined();
    expect(container.providerRegistry).toBeDefined();
    expect(container.whatsappProvider).toBeDefined();
    expect(container.instagramProvider).toBeDefined();
    expect(container.whatsappQueue).toBeDefined();
    expect(container.instagramQueue).toBeDefined();
    expect(container.whatsappWorker).toBeDefined();
    expect(container.instagramWorker).toBeDefined();
  });

  test("throws when required dependencies are missing", () => {
    expect(() => createOmnichannelNext({} as any)).toThrow("mysql.executor is required");

    const fakeQueue = { add: async () => undefined } as any;
    expect(() =>
      createOmnichannelNext({
        mysql: { executor: {} as any },
        queues: { whatsapp: null as any, instagram: null as any },
        transports: {} as any,
      } as any),
    ).toThrow("queues.whatsapp is required");

    expect(() =>
      createOmnichannelNext({
        mysql: { executor: {} as any },
        queues: { whatsapp: fakeQueue, instagram: fakeQueue },
        transports: {} as any,
      } as any),
    ).toThrow("transports.whatsapp is required");
  });

  test("two containers are independent", () => {
    const a = buildConfig();
    const b = buildConfig();
    const containerA = createOmnichannelNext(a.config);
    const containerB = createOmnichannelNext(b.config);

    expect(containerA.whatsappQueue).not.toBe(containerB.whatsappQueue);
    expect(containerA.whatsappProvider).not.toBe(containerB.whatsappProvider);
    expect(containerA.sendMessageService).not.toBe(containerB.sendMessageService);
  });

  test("WhatsApp command routes to WhatsApp queue only", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    const container = createOmnichannelNext(config);

    const result = await container.sendMessageService.execute({
      tenantId: TENANT,
      conversationId: WA_CONV,
      message: { type: "text", text: "oi" },
    });

    expect(result.provider).toBe("whatsapp");
    expect(waQueue.calls).toHaveLength(1);
    expect(igQueue.calls).toHaveLength(0);
    expect((waQueue.calls[0].data as { provider: string }).provider).toBe("whatsapp");
  });

  test("Instagram command routes to Instagram queue only", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    const container = createOmnichannelNext(config);

    const result = await container.sendMessageService.execute({
      tenantId: TENANT,
      conversationId: IG_CONV,
      message: { type: "text", text: "oi" },
    });

    expect(result.provider).toBe("instagram");
    expect(igQueue.calls).toHaveLength(1);
    expect(waQueue.calls).toHaveLength(0);
  });

  test("WA → IG → WA uses separated queues", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    const container = createOmnichannelNext(config);

    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } });
    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "2" } });
    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "3" } });

    expect(waQueue.calls).toHaveLength(2);
    expect(igQueue.calls).toHaveLength(1);
  });

  test("IG → WA → IG uses separated queues", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    const container = createOmnichannelNext(config);

    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "1" } });
    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "2" } });
    await container.sendMessageService.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "3" } });

    expect(igQueue.calls).toHaveLength(2);
    expect(waQueue.calls).toHaveLength(1);
  });

  test("parallel WA and IG commands do not interfere", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    const container = createOmnichannelNext(config);

    await Promise.all([
      container.sendMessageService.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } }),
      container.sendMessageService.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "2" } }),
    ]);

    expect(waQueue.calls).toHaveLength(1);
    expect(igQueue.calls).toHaveLength(1);
  });

  test("WhatsApp queue failure does not affect Instagram send", async () => {
    const { config, waQueue, igQueue } = buildConfig();
    waQueue.shouldThrow = true;
    const container = createOmnichannelNext(config);

    await expect(
      container.sendMessageService.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } }),
    ).rejects.toThrow("BullMQ add failed");

    const result = await container.sendMessageService.execute({
      tenantId: TENANT,
      conversationId: IG_CONV,
      message: { type: "text", text: "2" },
    });

    expect(result.provider).toBe("instagram");
    expect(igQueue.calls).toHaveLength(1);
  });
});
