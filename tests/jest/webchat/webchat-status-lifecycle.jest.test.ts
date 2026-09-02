import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { getWebchatHistory } from "@/lib/webchat/history.service";
import { enqueueChatOutboxMessage } from "@/lib/chat-outbox.server";
import { applyWebchatStatusAcks } from "@/lib/webchat/message-status.service";
import type { WebchatSession } from "@/lib/webchat/session.service";

const ORIGIN = "http://localhost:3000";
const counters = new Map<string, number>();

jest.mock("@/lib/cache", () => ({
  redis: {
    incr: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    publish: jest.fn(async () => 1),
  },
}));

/**
 * Full WebChat status lifecycle, mirroring what the browser widget does:
 *   CRM sends -> sent
 *   widget receives via history/poll -> delivered ACK
 *   visitor sees the bubble -> read ACK
 */
describe("WebChat Step 3 — end-to-end status lifecycle", () => {
  const tenantId = randomUUID();
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);

  let sessionToken = "";
  let session: WebchatSession;
  let conversationId = "";
  let contactPhone = "";

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'Lifecycle')`,
      [channelId, tenantId, `ext-${publicId}`],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
       VALUES (?, ?, ?, ?, 1, 'Lifecycle', ?)`,
      [widgetId, tenantId, channelId, publicId, JSON.stringify([ORIGIN])],
    );

    const created = await createWebchatSession(publicId, undefined, ORIGIN);
    sessionToken = created.sessionToken;
    session = created.session;

    // Visitor opens the conversation.
    const inbound = await handleWebchatInboundMessage(session, randomUUID(), "Olá Step 3");
    conversationId = inbound.conversationId;

    const identities = (await db.query(
      `SELECT external_id FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat' LIMIT 1`,
      [tenantId],
    )) as any[];
    contactPhone = `wc_${identities[0].external_id}`;

    // Refresh the session so it carries the conversation id.
    session = (await getWebchatSessionByToken(publicId, sessionToken, ORIGIN))!;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM chat_message_outbox WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM direct_messages WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contact_identities WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contacts WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [widgetId]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [channelId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  async function sendHumanReply(body: string): Promise<string> {
    const queued = await enqueueChatOutboxMessage({
      tenantId,
      userId: tenantId,
      clientMessageId: randomUUID(),
      contactPhone,
      channel: "webchat",
      channelConnectionId: channelId,
      conversationId,
      providerRecipientId: null,
      providerAccountId: null,
      type: "text",
      body,
      replyToMessageId: null,
      metadata: { text: { body } },
      payload: { type: "text", text: { body } },
    });
    // The outbox worker flips queued -> sent once the adapter accepts it.
    await db.query(`UPDATE direct_messages SET status = 'sent' WHERE id = ?`, [queued.messageId]);
    return queued.messageId;
  }

  async function statusOf(messageId: string): Promise<string> {
    const rows = (await db.query(`SELECT status FROM direct_messages WHERE id = ?`, [
      messageId,
    ])) as any[];
    return rows[0].status;
  }

  test("the session was correctly bound to the conversation", () => {
    expect(session.conversationId).toBe(conversationId);
    expect(session.channelConnectionId).toBe(channelId);
  });

  test("a human reply starts as sent, never delivered", async () => {
    const messageId = await sendHumanReply("Mensagem status Step 3");
    expect(await statusOf(messageId)).toBe("sent");

    const row = (await db.query(
      `SELECT delivered_at, read_at FROM direct_messages WHERE id = ?`,
      [messageId],
    )) as any[];
    expect(row[0].delivered_at).toBeNull();
    expect(row[0].read_at).toBeNull();
  });

  test("the widget sees the message in history and ACKs delivered", async () => {
    const messageId = await sendHumanReply("Vai ser entregue");

    const history = await getWebchatHistory(session, 50);
    const seen = history.find((m) => m.id === messageId);
    expect(seen).toBeDefined();
    expect(seen?.direction).toBe("outgoing");
    expect(seen?.status).toBe("sent");

    await applyWebchatStatusAcks(session, [{ messageId, status: "delivered" }]);
    expect(await statusOf(messageId)).toBe("delivered");
  });

  test("a closed widget never advances the message beyond delivered", async () => {
    const messageId = await sendHumanReply("Widget fechado");

    // Simulates polling while the panel is hidden: delivered only.
    await applyWebchatStatusAcks(session, [{ messageId, status: "delivered" }]);
    expect(await statusOf(messageId)).toBe("delivered");

    const row = (await db.query(`SELECT read_at FROM direct_messages WHERE id = ?`, [
      messageId,
    ])) as any[];
    expect(row[0].read_at).toBeNull();
  });

  test("opening the widget advances delivered to read", async () => {
    const messageId = await sendHumanReply("Vai ser lida");
    await applyWebchatStatusAcks(session, [{ messageId, status: "delivered" }]);
    expect(await statusOf(messageId)).toBe("delivered");

    await applyWebchatStatusAcks(session, [{ messageId, status: "read" }]);
    expect(await statusOf(messageId)).toBe("read");
  });

  test("history survives a reload and reports the persisted statuses", async () => {
    const messageId = await sendHumanReply("Persistida");
    await applyWebchatStatusAcks(session, [{ messageId, status: "read" }]);

    // Reload: brand new session lookup with the same stored token.
    const resumed = await getWebchatSessionByToken(publicId, sessionToken, ORIGIN);
    expect(resumed).not.toBeNull();
    expect(resumed?.conversationId).toBe(conversationId);

    const history = await getWebchatHistory(resumed!, 50);
    const reloaded = history.find((m) => m.id === messageId);
    expect(reloaded?.status).toBe("read");

    // No duplicated rows for the same logical message.
    const dupes = (await db.query(`SELECT COUNT(*) as n FROM direct_messages WHERE id = ?`, [
      messageId,
    ])) as any[];
    expect(dupes[0].n).toBe(1);
  });

  test("repeated ACKs after a reload stay cheap and idempotent", async () => {
    const messageId = await sendHumanReply("Idempotente");
    await applyWebchatStatusAcks(session, [{ messageId, status: "read" }]);
    const first = (await db.query(`SELECT read_at FROM direct_messages WHERE id = ?`, [
      messageId,
    ])) as any[];

    for (let i = 0; i < 5; i++) {
      const result = await applyWebchatStatusAcks(session, [
        { messageId, status: "delivered" },
        { messageId, status: "read" },
      ]);
      expect(result.updated).toEqual([]);
      expect(result.unchanged).toEqual([messageId]);
    }

    const last = (await db.query(`SELECT read_at, status FROM direct_messages WHERE id = ?`, [
      messageId,
    ])) as any[];
    expect(last[0].status).toBe("read");
    expect(new Date(last[0].read_at).getTime()).toBe(new Date(first[0].read_at).getTime());
  });

  test("the visitor's own inbound message is never ACK-able", async () => {
    const inbound = (await db.query(
      `SELECT id, status FROM direct_messages
       WHERE tenant_id = ? AND direction = 'incoming' LIMIT 1`,
      [tenantId],
    )) as any[];

    const result = await applyWebchatStatusAcks(session, [
      { messageId: inbound[0].id, status: "read" },
    ]);

    expect(result.rejected).toEqual([inbound[0].id]);
    const after = (await db.query(`SELECT status FROM direct_messages WHERE id = ?`, [
      inbound[0].id,
    ])) as any[];
    expect(after[0].status).toBe(inbound[0].status);
  });

  test("status ACKs never change the Inbox conversation preview", async () => {
    const messageId = await sendHumanReply("Preview intacto");

    const before = (await db.query(
      `SELECT body FROM direct_messages WHERE id = ?`,
      [messageId],
    )) as any[];

    await applyWebchatStatusAcks(session, [{ messageId, status: "read" }]);

    const after = (await db.query(
      `SELECT body FROM direct_messages WHERE id = ?`,
      [messageId],
    )) as any[];
    expect(after[0].body).toBe(before[0].body);
    expect(after[0].body).toBe("Preview intacto");
  });
});
