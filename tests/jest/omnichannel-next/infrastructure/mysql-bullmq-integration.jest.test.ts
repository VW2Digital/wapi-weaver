import { describe, expect, test } from "@jest/globals";
import { SendMessageService } from "@/lib/omnichannel-next/application/services/send-message.service";
import { ProviderQueueRouter } from "@/lib/omnichannel-next/application/outbox/provider-queue-router";
import {
  MySQLConversationRepository,
  MySQLChannelRepository,
  MySQLMessageRepository,
  BullMQWhatsAppQueue,
  BullMQInstagramQueue,
} from "@/lib/omnichannel-next/infrastructure";
import { FakeSqlExecutor, FakeBullMQQueue, NoOpTransaction } from "./test-fixtures";

const TENANT = "tenant-a";
const WA_CONV = "conv-wa-1";
const IG_CONV = "conv-ig-1";
const WA_CHANNEL = "channel-wa-1";
const IG_CHANNEL = "channel-ig-1";
const WA_CONTACT = "contact-wa-1";
const IG_CONTACT = "contact-ig-1";

const conversationSql = `SELECT id, tenant_id, contact_id, channel_connection_id FROM chat_sessions WHERE id = ? AND tenant_id = ? LIMIT 1`;
const channelSql = `SELECT id, tenant_id, provider, external_account_id, status FROM channel_connections WHERE id = ? AND tenant_id = ? LIMIT 1`;
const outboxSql = `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`;

function buildService() {
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

  const conversations = new MySQLConversationRepository(sql);
  const channels = new MySQLChannelRepository(sql);
  const messages = new MySQLMessageRepository(sql);

  const waFake = new FakeBullMQQueue();
  const igFake = new FakeBullMQQueue();
  const waQueue = new BullMQWhatsAppQueue(waFake);
  const igQueue = new BullMQInstagramQueue(igFake);
  const router = new ProviderQueueRouter();
  router.register(waQueue);
  router.register(igQueue);

  const transaction = new NoOpTransaction();
  const service = new SendMessageService(conversations, channels, messages, router, transaction);

  return { sql, service, waFake, igFake };
}

describe("MySQL + BullMQ integration", () => {
  test("WhatsApp command enqueues into the WhatsApp BullMQ queue", async () => {
    const { service, waFake, igFake } = buildService();

    const result = await service.execute({
      tenantId: TENANT,
      conversationId: WA_CONV,
      message: { type: "text", text: "oi" },
    });

    expect(result.provider).toBe("whatsapp");
    expect(result.status).toBe("queued");
    expect(waFake.calls).toHaveLength(1);
    expect(igFake.calls).toHaveLength(0);
    const data = waFake.calls[0].data as { provider: string };
    expect(data.provider).toBe("whatsapp");
  });

  test("Instagram command enqueues into the Instagram BullMQ queue", async () => {
    const { service, waFake, igFake } = buildService();

    const result = await service.execute({
      tenantId: TENANT,
      conversationId: IG_CONV,
      message: { type: "text", text: "oi" },
    });

    expect(result.provider).toBe("instagram");
    expect(igFake.calls).toHaveLength(1);
    expect(waFake.calls).toHaveLength(0);
  });

  test("WA → IG → WA uses separate queues", async () => {
    const { service, waFake, igFake } = buildService();

    await service.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } });
    await service.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "2" } });
    await service.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "3" } });

    expect(waFake.calls).toHaveLength(2);
    expect(igFake.calls).toHaveLength(1);
  });

  test("WA and IG commands can be enqueued in parallel", async () => {
    const { service, waFake, igFake } = buildService();

    await Promise.all([
      service.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } }),
      service.execute({ tenantId: TENANT, conversationId: IG_CONV, message: { type: "text", text: "2" } }),
    ]);

    expect(waFake.calls).toHaveLength(1);
    expect(igFake.calls).toHaveLength(1);
  });

  test("WhatsApp queue failure does not affect Instagram queue", async () => {
    const { service, waFake, igFake } = buildService();
    waFake.shouldThrow = true;

    await expect(
      service.execute({ tenantId: TENANT, conversationId: WA_CONV, message: { type: "text", text: "1" } }),
    ).rejects.toThrow("BullMQ add failed");

    const result = await service.execute({
      tenantId: TENANT,
      conversationId: IG_CONV,
      message: { type: "text", text: "2" },
    });

    expect(result.provider).toBe("instagram");
    expect(igFake.calls).toHaveLength(1);
  });
});
