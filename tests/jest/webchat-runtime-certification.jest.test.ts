import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { getWebchatHistory } from "@/lib/webchat/history.service";
import { enqueueChatOutboxMessage } from "@/lib/chat-outbox.server";

const ORIGIN = "http://localhost:3000";

describe("WebChat Step 2C — Runtime Inbox Certification", () => {
  const tenantId = `tenant-step2c-${randomUUID()}`;
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);
  const userId = tenantId;
  let sessionToken = "";
  let session: Awaited<ReturnType<typeof createWebchatSession>>["session"];
  let contactPhone = "";
  let conversationId = "";

  beforeAll(async () => {
    await db.query(
      `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
      [tenantId, `${tenantId}@test.local`, "test"],
    );
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'WebChat Step 2C')`,
      [channelId, tenantId, `ext-${publicId}`],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
       VALUES (?, ?, ?, ?, 1, 'Step 2C Widget', ?)`,
      [widgetId, tenantId, channelId, publicId, JSON.stringify([ORIGIN])],
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM chat_message_outbox WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM direct_messages WHERE tenant_id = ? AND channel = 'webchat'`, [tenantId]);
    await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat'`, [tenantId]);
    await db.query(`DELETE FROM contacts WHERE tenant_id = ? AND channel = 'webchat'`, [tenantId]);
    await db.query(`DELETE FROM webchat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [widgetId]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [channelId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  test("A — page load creates no contact/identity/conversation", async () => {
    const created = await createWebchatSession(publicId, undefined, ORIGIN);
    sessionToken = created.sessionToken;
    session = created.session;
    expect(session.visitorId).toBeTruthy();

    const contacts = (await db.query(`SELECT COUNT(*) as n FROM contacts WHERE tenant_id = ?`, [tenantId])) as any[];
    const identities = (await db.query(
      `SELECT COUNT(*) as n FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat'`,
      [tenantId],
    )) as any[];
    const conversations = (await db.query(`SELECT COUNT(*) as n FROM chat_sessions WHERE tenant_id = ?`, [tenantId])) as any[];

    expect(contacts[0].n).toBe(0);
    expect(identities[0].n).toBe(0);
    expect(conversations[0].n).toBe(0);
  });

  test("B — first message creates exactly one of each", async () => {
    const result = await handleWebchatInboundMessage(session, randomUUID(), "Olá, teste WebChat");
    expect(result.conversationId).toBeTruthy();
    expect(result.messageId).toBeTruthy();

    conversationId = result.conversationId;

    const conversations = (await db.query(
      `SELECT * FROM chat_sessions WHERE tenant_id = ? AND id = ?`,
      [tenantId, result.conversationId],
    )) as any[];
    expect(conversations.length).toBe(1);
    expect(conversations[0].channel_connection_id).toBe(channelId);

    const contactId = conversations[0].contact_id;
    const contacts = (await db.query(`SELECT * FROM contacts WHERE tenant_id = ? AND id = ?`, [tenantId, contactId])) as any[];
    expect(contacts.length).toBe(1);
    expect(contacts[0].phone_e164).toBeNull();
    expect(contacts[0].channel).toBe("webchat");

    const identities = (await db.query(
      `SELECT * FROM contact_identities WHERE tenant_id = ? AND contact_id = ? AND provider = 'webchat'`,
      [tenantId, contactId],
    )) as any[];
    expect(identities.length).toBe(1);
    contactPhone = `wc_${identities[0].external_id}`;

    const messages = (await db.query(
      `SELECT * FROM direct_messages WHERE tenant_id = ? AND conversation_id = ?`,
      [tenantId, result.conversationId],
    )) as any[];
    expect(messages.length).toBe(1);
    expect(messages[0].direction).toBe("incoming");
    expect(messages[0].body).toBe("Olá, teste WebChat");
    expect(messages[0].channel).toBe("webchat");
  });

  test("C — Inbox would list the WebChat conversation", async () => {
    const dm = (await db.query(
      `SELECT * FROM direct_messages WHERE tenant_id = ? AND conversation_id = ?`,
      [tenantId, conversationId],
    )) as any[];
    expect(dm.length).toBe(1);
    expect(dm[0].body).toBe("Olá, teste WebChat");

    const unread = (await db.query(
      `SELECT COUNT(*) as n FROM direct_messages
       WHERE tenant_id = ? AND conversation_id = ? AND direction = 'incoming' AND (status IS NULL OR status != 'read')`,
      [tenantId, conversationId],
    )) as any[];
    expect(unread[0].n).toBe(1);
  });

  test("D — human CRM reply reaches the same conversation", async () => {
    await enqueueChatOutboxMessage({
      tenantId,
      userId,
      clientMessageId: randomUUID(),
      contactPhone,
      channel: "webchat",
      channelConnectionId: channelId,
      conversationId,
      providerRecipientId: null,
      providerAccountId: null,
      type: "text",
      body: "Resposta humana teste WebChat",
      replyToMessageId: null,
      metadata: { text: { body: "Resposta humana teste WebChat" } },
      payload: { type: "text", text: { body: "Resposta humana teste WebChat" } },
    });

    const messages = (await db.query(
      `SELECT * FROM direct_messages WHERE tenant_id = ? AND conversation_id = ? ORDER BY created_at ASC`,
      [tenantId, conversationId],
    )) as any[];

    expect(messages.length).toBe(2);
    expect(messages[0].direction).toBe("incoming");
    expect(messages[1].direction).toBe("outgoing");
    expect(messages[1].body).toBe("Resposta humana teste WebChat");
    expect(messages[1].channel).toBe("webchat");
    expect(messages[1].channel_connection_id).toBe(channelId);
  });

  test("E — widget history restores both messages after reload", async () => {
    const freshSession = await getWebchatSessionByToken(publicId, sessionToken, ORIGIN);
    expect(freshSession).not.toBeNull();
    expect(freshSession?.conversationId).toBe(conversationId);

    const history = await getWebchatHistory(freshSession!, 10);
    expect(history.length).toBe(2);
    expect(history[0].body).toBe("Olá, teste WebChat");
    expect(history[1].body).toBe("Resposta humana teste WebChat");
  });

  test("F — second inbound reuses the same conversation", async () => {
    await handleWebchatInboundMessage(session, randomUUID(), "Segunda mensagem WebChat");

    const conversations = (await db.query(
      `SELECT COUNT(*) as n FROM chat_sessions WHERE tenant_id = ? AND contact_id = ?`,
      [tenantId, session.contactIdentityId],
    )) as any[];
    expect(conversations[0].n).toBe(1);

    const last = (await db.query(
      `SELECT body FROM direct_messages WHERE tenant_id = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
      [tenantId, conversationId],
    )) as any[];
    expect(last[0].body).toBe("Segunda mensagem WebChat");
  });
});
