import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { getWebchatHistory } from "@/lib/webchat/history.service";

const TENANT_ID = "webchat-test-tenant";
const CHANNEL_ID = "webchat-test-channel-inbound";
const WIDGET_ID = "webchat-test-widget-inbound";
const PUBLIC_ID = "webchat-test-public-inbound";
const ORIGIN = "http://localhost:3000";

describe("WebChat Inbound", () => {
  let session: any;
  let token: string;
  let visitorId: string;

  beforeAll(async () => {
    await db.query(`DELETE FROM direct_messages WHERE contact_phone LIKE 'wc_%' AND tenant_id = ?`, [TENANT_ID]);
    await db.query(`DELETE FROM webchat_sessions WHERE widget_id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [CHANNEL_ID]);

    const userExists = (await db.query(`SELECT id FROM users WHERE id = ?`, [TENANT_ID])) as any[];
    if (userExists.length === 0) {
      await db.query(
        `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
        [TENANT_ID, "webchat-test@example.com", "test"],
      );
    }

    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'WebChat Test')`,
      [CHANNEL_ID, TENANT_ID, "webchat-ext-" + PUBLIC_ID],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
       VALUES (?, ?, ?, ?, 1, 'Test Chat', ?)`,
      [WIDGET_ID, TENANT_ID, CHANNEL_ID, PUBLIC_ID, JSON.stringify([ORIGIN])],
    );

    const created = await createWebchatSession(PUBLIC_ID, undefined, ORIGIN);
    session = created.session;
    token = created.sessionToken;
    visitorId = session.visitorId;
  });

  afterAll(async () => {
    if (session?.conversationId) {
      await db.query(`DELETE FROM direct_messages WHERE conversation_id = ?`, [session.conversationId]);
    }
    await db.query(`DELETE FROM direct_messages WHERE contact_phone LIKE 'wc_%' AND tenant_id = ?`, [TENANT_ID]);
    await db.query(`DELETE FROM webchat_sessions WHERE widget_id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ? AND user_id = ?`, [TENANT_ID, TENANT_ID]);
    await db.query(`DELETE FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat'`, [TENANT_ID]);
    await db.query(
      `DELETE c FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE ci.tenant_id = ? AND ci.provider = 'webchat'`,
      [TENANT_ID],
    );
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [CHANNEL_ID]);
  });

  test("first message creates one identity, one contact and one conversation", async () => {
    const clientMessageId = randomUUID();
    const result = await handleWebchatInboundMessage(session, clientMessageId, "Olá");

    expect(result.messageId).toBeTruthy();
    expect(result.conversationId).toBeTruthy();
    expect(result.clientMessageId).toBe(clientMessageId);
    expect(result.duplicate).toBe(false);

    session.conversationId = result.conversationId;

    const identities = (await db.query(
      `SELECT id FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat' AND external_id = ?`,
      [TENANT_ID, visitorId],
    )) as any[];
    expect(identities.length).toBe(1);

    const contacts = (await db.query(
      `SELECT c.id FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE ci.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?`,
      [TENANT_ID, visitorId],
    )) as any[];
    expect(contacts.length).toBe(1);

    const conversations = (await db.query(
      `SELECT id FROM chat_sessions WHERE tenant_id = ? AND user_id = ? AND contact_id = ?`,
      [TENANT_ID, TENANT_ID, contacts[0].id],
    )) as any[];
    expect(conversations.length).toBe(1);

    const messages = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'incoming'`,
      [result.conversationId],
    )) as any[];
    expect(messages.length).toBe(1);
  });

  test("duplicate clientMessageId does not create another row", async () => {
    const clientMessageId = randomUUID();
    await handleWebchatInboundMessage(session, clientMessageId, "Primeira");
    const second = await handleWebchatInboundMessage(session, clientMessageId, "Primeira");

    expect(second.duplicate).toBe(true);

    const messages = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND provider_message_id = ?`,
      [session.conversationId, clientMessageId],
    )) as any[];
    expect(messages.length).toBe(1);
  });

  test("history is scoped to the conversation", async () => {
    const history = await getWebchatHistory(session, 50);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.every((m) => ["incoming", "outgoing"].includes(m.direction))).toBe(true);
  });

  test("rejects invalid clientMessageId", async () => {
    await expect(handleWebchatInboundMessage(session, "not-uuid", "text")).rejects.toThrow(/clientMessageId/);
  });

  test("rejects empty text", async () => {
    await expect(handleWebchatInboundMessage(session, randomUUID(), "   ")).rejects.toThrow(/empty/);
  });
});
