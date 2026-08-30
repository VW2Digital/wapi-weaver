import { describe, expect, test } from "@jest/globals";
import { OutboundJobService } from "@/lib/omnichannel-next/application/outbox/outbound-job.service";
import { createOmnichannelNext } from "@/lib/omnichannel-next/composition";
import { createWhatsappWorker, createInstagramWorker } from "@/lib/omnichannel-next/composition";
import { MetaWhatsAppTransport } from "@/lib/omnichannel-next/infrastructure/meta/whatsapp";
import { MetaInstagramTransport } from "@/lib/omnichannel-next/infrastructure/meta/instagram";
import { FakeSqlExecutor } from "../test-fixtures";
import { FakeBullMQQueue } from "../test-fixtures";
import { FakeHttpClient, FakeCredentialResolver } from "./test-fakes";

const TENANT = "tenant-a";
const WA_CHANNEL = "channel-wa-1";
const IG_CHANNEL = "channel-ig-1";
const PHONE_ID = "1107720082434785";
const IG_SENDER_ID = "IG_SENDER_123";
const WA_RECIPIENT = "5511999999999";
const IG_RECIPIENT = "IGSID_456";
const WA_MESSAGE_ID = "msg-wa-1";
const IG_MESSAGE_ID = "msg-ig-1";

const waConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp' LIMIT 1`;
const igConfigSql = `SELECT id, tenant_id, external_account_id, meta_app_connection_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'instagram' LIMIT 1`;
const outboxSql = `SELECT id, tenant_id, message_id, channel, status, provider_message_id, payload, attempts FROM chat_message_outbox WHERE id = ? LIMIT 1`;

function buildContainer() {
  const sql = new FakeSqlExecutor();
  const waQueue = new FakeBullMQQueue();
  const igQueue = new FakeBullMQQueue();
  const http = new FakeHttpClient();
  const credentials = new FakeCredentialResolver();

  credentials.addToken("wa-cred-ref", "WA_TOKEN_SENTINEL");
  credentials.addToken("ig-cred-ref", "IG_TOKEN_SENTINEL");

  const waTransport = new MetaWhatsAppTransport(
    { graphApiVersion: "25.0" },
    http,
    credentials,
  );
  const igTransport = new MetaInstagramTransport(
    { graphApiVersion: "25.0" },
    http,
    credentials,
  );

  sql.addResult(waConfigSql, [
    { id: WA_CHANNEL, tenant_id: TENANT, external_account_id: PHONE_ID, meta_app_connection_id: "wa-cred-ref" },
  ], [WA_CHANNEL, TENANT]);
  sql.addResult(igConfigSql, [
    { id: IG_CHANNEL, tenant_id: TENANT, external_account_id: IG_SENDER_ID, meta_app_connection_id: "ig-cred-ref" },
  ], [IG_CHANNEL, TENANT]);

  sql.addResult(outboxSql, [makeMessageRow(WA_MESSAGE_ID, WA_CHANNEL, WA_RECIPIENT, "hello WA")], [WA_MESSAGE_ID]);
  sql.addResult(outboxSql, [makeMessageRow(IG_MESSAGE_ID, IG_CHANNEL, IG_RECIPIENT, "hello IG")], [IG_MESSAGE_ID]);

  http.setFixture(
    `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
    200,
    { messages: [{ id: "wamid.FLOW" }] },
  );
  http.setFixture(
    `https://graph.instagram.com/v25.0/${IG_SENDER_ID}/messages`,
    200,
    { message_id: "ig-mid-FLOW" },
  );

  const container = createOmnichannelNext({
    mysql: { executor: sql },
    queues: { whatsapp: waQueue, instagram: igQueue },
    transports: { whatsapp: waTransport, instagram: igTransport },
  });

  return { sql, http, container };
}

function makeMessageRow(id: string, channelId: string, recipient: string, text: string) {
  const provider = id.startsWith("msg-wa") ? "whatsapp" : "instagram";
  return {
    id,
    tenant_id: TENANT,
    message_id: id,
    channel: provider,
    status: "pending",
    provider_message_id: null,
    payload: JSON.stringify({
      conversationId: `conv-${provider}`,
      channelConnectionId: channelId,
      message: { type: "text", text },
    }),
    attempts: 0,
  };
}

describe("Meta transport shadow flow", () => {
  test("full WhatsApp flow reaches graph.facebook.com with correct token", async () => {
    const { http, container } = buildContainer();
    const worker = createWhatsappWorker(container);
    await worker.start();

    const job = OutboundJobService.build({
      tenantId: TENANT,
      messageId: WA_MESSAGE_ID,
      conversationId: "conv-wa",
      channelConnectionId: WA_CHANNEL,
      provider: "whatsapp",
      recipient: WA_RECIPIENT,
      message: { type: "text", text: "hello WA" },
    });

    const result = await worker.process(job);

    expect(result.status).toBe("accepted");
    expect(http.requests).toHaveLength(1);

    const req = http.requests[0];
    expect(req.url).toBe(`https://graph.facebook.com/v25.0/${PHONE_ID}/messages`);
    expect(req.headers?.Authorization).toBe("Bearer WA_TOKEN_SENTINEL");
  });

  test("full Instagram flow reaches graph.instagram.com with correct token", async () => {
    const { http, container } = buildContainer();
    const worker = createInstagramWorker(container);
    await worker.start();

    const job = OutboundJobService.build({
      tenantId: TENANT,
      messageId: IG_MESSAGE_ID,
      conversationId: "conv-ig",
      channelConnectionId: IG_CHANNEL,
      provider: "instagram",
      recipient: IG_RECIPIENT,
      message: { type: "text", text: "hello IG" },
    });

    const result = await worker.process(job);

    expect(result.status).toBe("accepted");
    expect(http.requests).toHaveLength(1);

    const req = http.requests[0];
    expect(req.url).toBe(`https://graph.instagram.com/v25.0/${IG_SENDER_ID}/messages`);
    expect(req.headers?.Authorization).toBe("Bearer IG_TOKEN_SENTINEL");
  });

  test("WA transport failure does not affect Instagram transport", async () => {
    const { http, container } = buildContainer();
    const httpWa = new FakeHttpClient();
    const httpIg = new FakeHttpClient();

    // Rebuild transports with separate HTTP clients to isolate failures.
    const credentials = new FakeCredentialResolver();
    credentials.addToken("wa-cred-ref", "WA_TOKEN_SENTINEL");
    credentials.addToken("ig-cred-ref", "IG_TOKEN_SENTINEL");

    httpWa.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      500,
      { error: { code: 1, message: "Meta down" } },
    );
    httpIg.setFixture(
      `https://graph.instagram.com/v25.0/${IG_SENDER_ID}/messages`,
      200,
      { message_id: "ig-mid-OK" },
    );

    const waTransport = new MetaWhatsAppTransport({ graphApiVersion: "25.0" }, httpWa, credentials);
    const igTransport = new MetaInstagramTransport({ graphApiVersion: "25.0" }, httpIg, credentials);

    const { sql } = buildContainer();

    const shadowContainer = createOmnichannelNext({
      mysql: { executor: sql },
      queues: { whatsapp: new FakeBullMQQueue(), instagram: new FakeBullMQQueue() },
      transports: { whatsapp: waTransport, instagram: igTransport },
    });

    const waWorker = createWhatsappWorker(shadowContainer);
    const igWorker = createInstagramWorker(shadowContainer);

    await waWorker.start();
    await igWorker.start();

    const waJob = OutboundJobService.build({
      tenantId: TENANT,
      messageId: WA_MESSAGE_ID,
      conversationId: "conv-wa",
      channelConnectionId: WA_CHANNEL,
      provider: "whatsapp",
      recipient: WA_RECIPIENT,
      message: { type: "text", text: "fail" },
    });

    const igJob = OutboundJobService.build({
      tenantId: TENANT,
      messageId: IG_MESSAGE_ID,
      conversationId: "conv-ig",
      channelConnectionId: IG_CHANNEL,
      provider: "instagram",
      recipient: IG_RECIPIENT,
      message: { type: "text", text: "ok" },
    });

    await expect(waWorker.process(waJob)).rejects.toThrow("META_WHATSAPP_500");

    const result = await igWorker.process(igJob);
    expect(result.status).toBe("accepted");
  });
});
