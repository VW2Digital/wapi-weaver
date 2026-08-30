import { describe, expect, test } from "@jest/globals";
import { OutboundJobService } from "@/lib/omnichannel-next/application/outbox/outbound-job.service";
import { createOmnichannelNext } from "@/lib/omnichannel-next/composition";
import { createWhatsappWorker } from "@/lib/omnichannel-next/composition";
import { createInstagramWorker } from "@/lib/omnichannel-next/composition";
import { FakeSqlExecutor, FakeBullMQQueue } from "../infrastructure/test-fixtures";
import { FakeWhatsAppTransport, FakeInstagramTransport } from "./test-fakes";

const TENANT = "tenant-a";
const WA_CONV = "conv-wa-1";
const IG_CONV = "conv-ig-1";
const WA_CHANNEL = "channel-wa-1";
const IG_CHANNEL = "channel-ig-1";
const WA_CONTACT = "contact-wa-1";
const IG_CONTACT = "contact-ig-1";

const outboxSql = `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`;
const waConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp' LIMIT 1`;
const igConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'instagram' LIMIT 1`;

function buildWaContainer() {
  const sql = new FakeSqlExecutor();
  const waQueue = new FakeBullMQQueue();
  const igQueue = new FakeBullMQQueue();
  const waTransport = new FakeWhatsAppTransport();
  const igTransport = new FakeInstagramTransport();

  sql.addResult(waConfigSql, [
    { id: WA_CHANNEL, tenant_id: TENANT, external_account_id: "1107720082434785", meta_app_connection_id: "meta-app-wa-1" },
  ], [WA_CHANNEL, TENANT]);

  const container = createOmnichannelNext({
    mysql: { executor: sql },
    queues: { whatsapp: waQueue, instagram: igQueue },
    transports: { whatsapp: waTransport, instagram: igTransport },
  });

  return { sql, waQueue, igQueue, waTransport, igTransport, container };
}

function buildIgContainer() {
  const sql = new FakeSqlExecutor();
  const waQueue = new FakeBullMQQueue();
  const igQueue = new FakeBullMQQueue();
  const waTransport = new FakeWhatsAppTransport();
  const igTransport = new FakeInstagramTransport();

  sql.addResult(igConfigSql, [
    { id: IG_CHANNEL, tenant_id: TENANT, external_account_id: "349476715907213", meta_app_connection_id: "meta-app-ig-1" },
  ], [IG_CHANNEL, TENANT]);

  const container = createOmnichannelNext({
    mysql: { executor: sql },
    queues: { whatsapp: waQueue, instagram: igQueue },
    transports: { whatsapp: waTransport, instagram: igTransport },
  });

  return { sql, waQueue, igQueue, waTransport, igTransport, container };
}

function makeMessageRow(messageId: string, conversationId: string, channelId: string, text: string, channel: string) {
  return {
    id: messageId,
    tenant_id: TENANT,
    message_id: messageId,
    channel,
    status: "pending",
    provider_message_id: null,
    payload: JSON.stringify({
      conversationId,
      channelConnectionId: channelId,
      message: { type: "text", text },
    }),
    attempts: 0,
  };
}

describe("Worker composition", () => {
  test("WhatsApp worker processes a WhatsApp job", async () => {
    const { sql, waTransport, container } = buildWaContainer();
    const messageId = "msg-wa-1";
    sql.addResult(outboxSql, [makeMessageRow(messageId, WA_CONV, WA_CHANNEL, "oi", "whatsapp")], [messageId]);

    const worker = createWhatsappWorker(container);
    await worker.start();

    const job = OutboundJobService.build({
      tenantId: TENANT,
      messageId,
      conversationId: WA_CONV,
      channelConnectionId: WA_CHANNEL,
      provider: "whatsapp",
      recipient: WA_CONTACT,
      message: { type: "text", text: "oi" },
    });

    const result = await worker.process(job);

    expect(result.status).toBe("accepted");
    expect(result.providerMessageId).toBe("wa-msg-123");
    expect(waTransport.calls).toHaveLength(1);
    expect(waTransport.calls[0].sender).toBe("1107720082434785");
    expect(waTransport.calls[0].credentialReference).toBe("meta-app-wa-1");
  });

  test("Instagram worker processes an Instagram job", async () => {
    const { sql, igTransport, container } = buildIgContainer();
    const messageId = "msg-ig-1";
    sql.addResult(outboxSql, [makeMessageRow(messageId, IG_CONV, IG_CHANNEL, "oi", "instagram")], [messageId]);

    const worker = createInstagramWorker(container);
    await worker.start();

    const job = OutboundJobService.build({
      tenantId: TENANT,
      messageId,
      conversationId: IG_CONV,
      channelConnectionId: IG_CHANNEL,
      provider: "instagram",
      recipient: IG_CONTACT,
      message: { type: "text", text: "oi" },
    });

    const result = await worker.process(job);

    expect(result.status).toBe("accepted");
    expect(result.providerMessageId).toBe("ig-msg-123");
    expect(igTransport.calls).toHaveLength(1);
    expect(igTransport.calls[0].sender).toBe("349476715907213");
  });

  test("worker rejects a job for the wrong provider", async () => {
    const { sql, container } = buildWaContainer();
    const messageId = "msg-wa-1";
    sql.addResult(outboxSql, [makeMessageRow(messageId, WA_CONV, WA_CHANNEL, "oi", "whatsapp")], [messageId]);

    const worker = createWhatsappWorker(container);
    await worker.start();

    const job = OutboundJobService.build({
      tenantId: TENANT,
      messageId,
      conversationId: IG_CONV,
      channelConnectionId: IG_CHANNEL,
      provider: "instagram",
      recipient: IG_CONTACT,
      message: { type: "text", text: "oi" },
    });

    await expect(worker.process(job)).rejects.toThrow(/cannot process/);
  });

  test("worker start is idempotent", async () => {
    const { container } = buildWaContainer();
    const worker = createWhatsappWorker(container);

    await worker.start();
    await expect(worker.start()).rejects.toThrow(/already running/);
  });

  test("worker stop is idempotent", async () => {
    const { container } = buildWaContainer();
    const worker = createWhatsappWorker(container);

    await worker.start();
    await worker.stop();
    await worker.stop();
    expect(worker.isRunning()).toBe(false);
  });

  test("WhatsApp worker failure does not affect Instagram worker", async () => {
    const wa = buildWaContainer();
    const ig = buildIgContainer();
    wa.waTransport.shouldThrow = true;

    const waMessageId = "msg-wa-1";
    wa.sql.addResult(outboxSql, [makeMessageRow(waMessageId, WA_CONV, WA_CHANNEL, "fail", "whatsapp")], [waMessageId]);

    const igMessageId = "msg-ig-1";
    ig.sql.addResult(outboxSql, [makeMessageRow(igMessageId, IG_CONV, IG_CHANNEL, "ok", "instagram")], [igMessageId]);

    const waWorker = createWhatsappWorker(wa.container);
    const igWorker = createInstagramWorker(ig.container);
    await waWorker.start();
    await igWorker.start();

    const waJob = OutboundJobService.build({
      tenantId: TENANT,
      messageId: waMessageId,
      conversationId: WA_CONV,
      channelConnectionId: WA_CHANNEL,
      provider: "whatsapp",
      recipient: WA_CONTACT,
      message: { type: "text", text: "fail" },
    });

    const igJob = OutboundJobService.build({
      tenantId: TENANT,
      messageId: igMessageId,
      conversationId: IG_CONV,
      channelConnectionId: IG_CHANNEL,
      provider: "instagram",
      recipient: IG_CONTACT,
      message: { type: "text", text: "ok" },
    });

    await expect(waWorker.process(waJob)).rejects.toThrow("WhatsApp transport failed");

    const result = await igWorker.process(igJob);
    expect(result.status).toBe("accepted");
    expect(result.providerMessageId).toBe("ig-msg-123");
  });
});
