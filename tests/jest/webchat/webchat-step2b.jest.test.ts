import { beforeAll, afterAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { getWebchatHistory } from "@/lib/webchat/history.service";
import { saveMessage } from "@/lib/messaging/services/message.service";
import { providerDispatcher } from "@/lib/messaging/outbound/provider-dispatcher";
import { WebChatOutboundAdapter } from "@/lib/messaging/outbound/adapters/webchat-outbound-adapter";
import { checkSessionCreationRateLimit, checkMessageRateLimit } from "@/lib/webchat/rate-limit.service";
import type { CanonicalMessage } from "@/lib/messaging/types";

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
  },
}));

beforeEach(() => {
  counters.clear();
});

interface TestWidget {
  tenantId: string;
  channelId: string;
  widgetId: string;
  publicId: string;
}

async function createUser(tenantId: string) {
  await db.query(
    `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email = email`,
    [tenantId, `${tenantId}@test.local`, "test"],
  );
}

async function deleteUser(tenantId: string) {
  await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
}

async function setupWidget(allowedOrigins: string[] = [ORIGIN]): Promise<TestWidget> {
  const tenantId = randomUUID();
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);

  await createUser(tenantId);
  await db.query(
    `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
     VALUES (?, ?, 'webchat', 'active', ?, 'WebChat Test')`,
    [channelId, tenantId, `ext-${publicId}`],
  );
  await db.query(
    `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
     VALUES (?, ?, ?, ?, 1, 'Test Chat', ?)`,
    [widgetId, tenantId, channelId, publicId, JSON.stringify(allowedOrigins)],
  );

  return { tenantId, channelId, widgetId, publicId };
}

async function cleanupWidget(ctx: TestWidget) {
  await db.query(`DELETE FROM direct_messages WHERE tenant_id = ? AND channel = 'webchat'`, [ctx.tenantId]);
  await db.query(`DELETE FROM webchat_sessions WHERE widget_id = ?`, [ctx.widgetId]);
  await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [ctx.widgetId]);
  await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [ctx.tenantId]);
  await db.query(`DELETE FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat'`, [ctx.tenantId]);
  await db.query(`DELETE c FROM contacts c JOIN contact_identities ci ON ci.contact_id = c.id WHERE ci.tenant_id = ? AND ci.provider = 'webchat'`, [ctx.tenantId]);
  await db.query(`DELETE FROM channel_connections WHERE id = ?`, [ctx.channelId]);
  await deleteUser(ctx.tenantId);
}

async function setupBotFlow(ctx: TestWidget, flowId: string, stepId: string) {
  const settingsId = randomUUID();
  await db.query(
    `INSERT INTO bot_settings (id, user_id, tenant_id, instance_id, is_active, channel, name)
     VALUES (?, ?, ?, NULL, 0, 'whatsapp', 'Test Settings')`,
    [settingsId, ctx.tenantId, ctx.tenantId],
  );
  await db.query(
    `INSERT INTO bot_flows (id, user_id, tenant_id, name, channel, is_active)
     VALUES (?, ?, ?, 'Test Flow', 'webchat', 1)`,
    [flowId, ctx.tenantId, ctx.tenantId],
  );
  await db.query(
    `INSERT INTO bot_steps (id, flow_id, user_id, tenant_id, bot_settings_id, step_order, trigger_type, message_type, message_content)
     VALUES (?, ?, ?, ?, ?, 1, 'first_message', 'text', 'Resposta automatizada do bot')`,
    [stepId, flowId, ctx.tenantId, ctx.tenantId, settingsId],
  );
}

describe("WebChat Step 2B — First Interaction & Page Load", () => {
  let ctx: TestWidget;
  let sessionToken: string;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    sessionToken = created.sessionToken;
    session = created.session;
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("page load does not create contact, identity or conversation", async () => {
    const contacts = (await db.query(`SELECT COUNT(*) as n FROM contacts WHERE tenant_id = ?`, [ctx.tenantId])) as any[];
    const identities = (await db.query(`SELECT COUNT(*) as n FROM contact_identities WHERE tenant_id = ? AND provider = 'webchat'`, [ctx.tenantId])) as any[];
    const conversations = (await db.query(`SELECT COUNT(*) as n FROM chat_sessions WHERE tenant_id = ?`, [ctx.tenantId])) as any[];

    expect(contacts[0].n).toBe(0);
    expect(identities[0].n).toBe(0);
    expect(conversations[0].n).toBe(0);
  });

  test("first message creates one identity, one contact, one conversation", async () => {
    const clientMessageId = randomUUID();
    await handleWebchatInboundMessage(session, clientMessageId, "Olá WebChat");

    const contacts = (await db.query(
      `SELECT c.id FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE ci.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?`,
      [ctx.tenantId, session.visitorId],
    )) as any[];
    expect(contacts.length).toBe(1);

    const conversations = (await db.query(
      `SELECT id FROM chat_sessions WHERE tenant_id = ? AND contact_id = ?`,
      [ctx.tenantId, contacts[0].id],
    )) as any[];
    expect(conversations.length).toBe(1);

    const messages = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'incoming'`,
      [conversations[0].id],
    )) as any[];
    expect(messages.length).toBe(1);
  });
});

describe("WebChat Step 2B — Bot Active", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const flowId = randomUUID();
    const stepId = randomUUID();
    await setupBotFlow(ctx, flowId, stepId);
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM bot_conversation_state WHERE user_id = ? AND channel = 'webchat'`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_steps WHERE tenant_id = ?`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_flows WHERE tenant_id = ?`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_settings WHERE user_id = ?`, [ctx.tenantId]);
    await cleanupWidget(ctx);
  });

  test("active bot produces exactly one outgoing response", async () => {
    const clientMessageId = randomUUID();
    const { conversationId } = await handleWebchatInboundMessage(session, clientMessageId, "Teste bot ativo");
    session.conversationId = conversationId;

    const incoming = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'incoming'`,
      [conversationId],
    )) as any[];
    expect(incoming.length).toBe(1);

    const outgoing = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'outgoing' AND status = 'sent'`,
      [conversationId],
    )) as any[];
    expect(outgoing.length).toBe(1);

    const history = await getWebchatHistory(session, 50);
    expect(history.length).toBe(2);
    expect(history.filter((m) => m.direction === "outgoing").length).toBe(1);
    expect(history.find((m) => m.direction === "outgoing")?.body).toBe("Resposta automatizada do bot");
  });
});

describe("WebChat Step 2B — Bot Paused", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const flowId = randomUUID();
    const stepId = randomUUID();
    await setupBotFlow(ctx, flowId, stepId);
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM bot_conversation_state WHERE user_id = ? AND channel = 'webchat'`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_steps WHERE tenant_id = ?`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_flows WHERE tenant_id = ?`, [ctx.tenantId]);
    await db.query(`DELETE FROM bot_settings WHERE user_id = ?`, [ctx.tenantId]);
    await cleanupWidget(ctx);
  });

  test("paused bot stores inbound but does not produce any bot response", async () => {
    // Pause the conversation before the message arrives
    await db.query(
      `INSERT INTO bot_conversation_state (id, user_id, tenant_id, contact_number, instance_id, channel, bot_active, is_paused, paused_until)
       VALUES (?, ?, ?, ?, ?, 'webchat', 1, 1, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [randomUUID(), ctx.tenantId, ctx.tenantId, `wc_${session.visitorId}`, ctx.channelId],
    );

    const clientMessageId = randomUUID();
    const { conversationId } = await handleWebchatInboundMessage(session, clientMessageId, "Teste bot pausado");
    session.conversationId = conversationId;

    const incoming = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'incoming'`,
      [conversationId],
    )) as any[];
    expect(incoming.length).toBe(1);

    const outgoing = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'outgoing'`,
      [conversationId],
    )) as any[];
    expect(outgoing.length).toBe(0);

    const history = await getWebchatHistory(session, 50);
    expect(history.length).toBe(1);
    expect(history.every((m) => m.direction === "incoming")).toBe(true);
  });
});

describe("WebChat Step 2B — Human Outbound", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;
    const clientMessageId = randomUUID();
    const { conversationId } = await handleWebchatInboundMessage(session, clientMessageId, "Olá");
    session.conversationId = conversationId;
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("CRM human reply is stored, dispatched through webchat adapter and visible in history", async () => {
    const contact = (await db.query(
      `SELECT c.id FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE ci.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?`,
      [ctx.tenantId, session.visitorId],
    )) as any[];
    const contactId = contact[0].id;

    const providerMessageId = randomUUID();
    const outboundMessage: CanonicalMessage = {
      providerMessageId,
      direction: "outgoing",
      type: "text",
      body: "Resposta humana WebChat",
      sender: { externalId: ctx.publicId, name: null, phoneE164: null },
      recipient: { externalId: session.visitorId, name: null, phoneE164: null },
    };

    await saveMessage({
      tenantId: ctx.tenantId,
      userId: ctx.tenantId,
      contactId,
      conversationId: session.conversationId,
      contactPhone: `wc_${session.visitorId}`,
      provider: "webchat",
      channelResourceId: ctx.publicId,
      channelConnectionId: ctx.channelId,
      message: outboundMessage,
      clientMessageId: randomUUID(),
    });

    const result = await providerDispatcher.dispatch({
      tenantId: ctx.tenantId,
      userId: ctx.tenantId,
      messageId: providerMessageId,
      conversationId: session.conversationId,
      channelConnectionId: ctx.channelId,
      provider: "webchat",
      contactPhone: `wc_${session.visitorId}`,
      providerAccountId: ctx.channelId,
      type: "text",
      payload: { type: "text", text: { body: "Resposta humana WebChat" } },
      metadata: {},
    });

    expect(result.provider).toBe("webchat");
    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBeTruthy();

    const outgoing = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND direction = 'outgoing'`,
      [session.conversationId],
    )) as any[];
    expect(outgoing.length).toBe(1);

    const history = await getWebchatHistory(session, 50);
    expect(history.find((m) => m.direction === "outgoing")?.body).toBe("Resposta humana WebChat");
  });
});

describe("WebChat Step 2B — Multi-tenant", () => {
  let tenantA: TestWidget;
  let tenantB: TestWidget;
  let sessionA: any;
  let sessionB: any;

  beforeAll(async () => {
    tenantA = await setupWidget();
    tenantB = await setupWidget();
    const a = await createWebchatSession(tenantA.publicId, undefined, ORIGIN);
    const b = await createWebchatSession(tenantB.publicId, undefined, ORIGIN);
    sessionA = a.session;
    sessionB = b.session;
  });

  afterAll(async () => {
    await cleanupWidget(tenantA);
    await cleanupWidget(tenantB);
  });

  test("session token from tenant A cannot validate against tenant B widget", async () => {
    const cross = await getWebchatSessionByToken(tenantB.publicId, sessionA.sessionToken, ORIGIN);
    expect(cross).toBeNull();
  });

  test("history is isolated by tenant", async () => {
    const { conversationId } = await handleWebchatInboundMessage(sessionA, randomUUID(), "Msg A");
    sessionA.conversationId = conversationId;
    const { conversationId: convB } = await handleWebchatInboundMessage(sessionB, randomUUID(), "Msg B");
    sessionB.conversationId = convB;

    // Attempt to read A's conversation from B's tenant context
    const forged = { ...sessionB, conversationId } as any;
    const history = await getWebchatHistory(forged, 50);
    expect(history.length).toBe(0);
  });
});

describe("WebChat Step 2B — Multiple Widgets Same Tenant", () => {
  let tenantId: string;
  let widgetA: TestWidget;
  let widgetB: TestWidget;
  let sessionA: any;
  let sessionB: any;

  beforeAll(async () => {
    tenantId = randomUUID();
    await createUser(tenantId);

    const make = async (suffix: string) => {
      const channelId = randomUUID();
      const widgetId = randomUUID();
      const publicId = `${suffix}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      await db.query(
        `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
         VALUES (?, ?, 'webchat', 'active', ?, 'WebChat ${suffix}')`,
        [channelId, tenantId, `ext-${publicId}`],
      );
      await db.query(
        `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
         VALUES (?, ?, ?, ?, 1, 'Widget ${suffix}', ?)`,
        [widgetId, tenantId, channelId, publicId, JSON.stringify([ORIGIN])],
      );
      return { tenantId, channelId, widgetId, publicId } as TestWidget;
    };

    widgetA = await make("A");
    widgetB = await make("B");
    const a = await createWebchatSession(widgetA.publicId, undefined, ORIGIN);
    const b = await createWebchatSession(widgetB.publicId, undefined, ORIGIN);
    sessionA = a.session;
    sessionB = b.session;
  });

  afterAll(async () => {
    await cleanupWidget(widgetA);
    await cleanupWidget(widgetB);
  });

  test("each session routes to its own channel and conversation", async () => {
    expect(sessionA.channelConnectionId).toBe(widgetA.channelId);
    expect(sessionB.channelConnectionId).toBe(widgetB.channelId);
    expect(sessionA.channelConnectionId).not.toBe(sessionB.channelConnectionId);

    const resultA = await handleWebchatInboundMessage(sessionA, randomUUID(), "A");
    const resultB = await handleWebchatInboundMessage(sessionB, randomUUID(), "B");

    expect(resultA.conversationId).not.toBe(resultB.conversationId);
  });

  test("cross-widget history is blocked", async () => {
    const { conversationId } = await handleWebchatInboundMessage(sessionA, randomUUID(), "Only A");
    sessionA.conversationId = conversationId;

    const forged = { ...sessionB, conversationId } as any;
    const history = await getWebchatHistory(forged, 50);
    expect(history.length).toBe(0);
  });
});

describe("WebChat Step 2B — Rate Limit", () => {
  let ctx: TestWidget;

  beforeAll(async () => {
    ctx = await setupWidget();
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("session creation rate limit returns 429 after threshold", async () => {
    const publicId = ctx.publicId;
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });

    // limit is 10 per minute
    for (let i = 0; i < 10; i++) {
      const ok = await checkSessionCreationRateLimit(publicId, request);
      expect(ok).toBe(true);
    }

    const blocked = await checkSessionCreationRateLimit(publicId, request);
    expect(blocked).toBe(false);
  });

  test("message rate limit does not create message when blocked", async () => {
    const sessionId = randomUUID();
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });

    for (let i = 0; i < 60; i++) {
      const ok = await checkMessageRateLimit(sessionId, request);
      expect(ok).toBe(true);
    }

    const blocked = await checkMessageRateLimit(sessionId, request);
    expect(blocked).toBe(false);
  });

  test("rate limit keys are tenant-scoped", async () => {
    const reqA = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const reqB = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });

    const okA = await checkSessionCreationRateLimit(ctx.publicId, reqA);
    expect(okA).toBe(true);
    const okB = await checkSessionCreationRateLimit("different-public", reqB);
    expect(okB).toBe(true);
  });
});

describe("WebChat Step 2B — XSS & SQL-like Input", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test.each([
    ["<script>alert(1)</script>"],
    ["<img src=x onerror=alert(1)>"],
    ["' OR 1=1; DROP TABLE contacts; --"],
  ])("stores dangerous input as plain text: %s", async (text) => {
    const clientMessageId = randomUUID();
    const { messageId } = await handleWebchatInboundMessage(session, clientMessageId, text);

    const rows = (await db.query(`SELECT body FROM direct_messages WHERE id = ?`, [messageId])) as any[];

    expect(rows.length).toBe(1);
    expect(rows[0].body).toBe(text);
  });
});

describe("WebChat Step 2B — Idempotency", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("sequential duplicate clientMessageId produces one logical message", async () => {
    const clientMessageId = randomUUID();
    const first = await handleWebchatInboundMessage(session, clientMessageId, "Primeira");
    const second = await handleWebchatInboundMessage(session, clientMessageId, "Primeira");

    expect(second.messageId).toBe(first.messageId);
    expect(second.duplicate).toBe(true);

    const rows = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND provider_message_id = ?`,
      [first.conversationId, clientMessageId],
    )) as any[];
    expect(rows.length).toBe(1);
  });

  test("concurrent duplicate clientMessageId produces one logical message", async () => {
    const clientMessageId = randomUUID();
    const [a, b] = await Promise.all([
      handleWebchatInboundMessage(session, clientMessageId, "Concurrent"),
      handleWebchatInboundMessage(session, clientMessageId, "Concurrent"),
    ]);

    expect(a.messageId).toBe(b.messageId);
    expect([a.duplicate, b.duplicate].filter(Boolean).length).toBe(1);

    const rows = (await db.query(
      `SELECT id FROM direct_messages WHERE conversation_id = ? AND provider_message_id = ?`,
      [a.conversationId, clientMessageId],
    )) as any[];
    expect(rows.length).toBe(1);
  });
});

describe("WebChat Step 2B — Resume & Expired", () => {
  let ctx: TestWidget;
  let session: any;
  let token: string;
  let visitorId: string;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    token = created.sessionToken;
    session = created.session;
    visitorId = session.visitorId;
    const clientMessageId = randomUUID();
    const { conversationId } = await handleWebchatInboundMessage(session, clientMessageId, "Resume");
    session.conversationId = conversationId;
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("session resume with new token keeps same contact and conversation", async () => {
    const resumed = await createWebchatSession(ctx.publicId, visitorId, ORIGIN);

    expect(resumed.session.visitorId).toBe(visitorId);
    expect(resumed.session.conversationId).toBe(session.conversationId);

    const contacts = (await db.query(
      `SELECT c.id FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE ci.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?`,
      [ctx.tenantId, visitorId],
    )) as any[];
    expect(contacts.length).toBe(1);

    const conversations = (await db.query(
      `SELECT id FROM chat_sessions WHERE tenant_id = ? AND contact_id = ?`,
      [ctx.tenantId, contacts[0].id],
    )) as any[];
    expect(conversations.length).toBe(1);

    const oldSession = await getWebchatSessionByToken(ctx.publicId, token, ORIGIN);
    expect(oldSession).toBeNull();
  });

  test("expired token is rejected and history stays isolated", async () => {
    const fresh = await createWebchatSession(ctx.publicId, randomUUID(), ORIGIN);
    const rawToken = fresh.sessionToken;
    await db.query(
      `UPDATE webchat_sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?`,
      [fresh.session.id],
    );

    const expired = await getWebchatSessionByToken(ctx.publicId, rawToken, ORIGIN);
    expect(expired).toBeNull();

    const history = await getWebchatHistory(fresh.session, 50);
    expect(history.length).toBe(0);
  });
});

describe("WebChat Step 2B — Origin Security", () => {
  let ctx: TestWidget;

  beforeAll(async () => {
    ctx = await setupWidget(["http://site-a.example"]);
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test.each([
    ["http://site-a.example", true],
    ["https://evil.example", false],
    ["https://site-a.example.evil.com", false],
    ["https://evilsite-a.example", false],
    ["http://site-a.example:8080", false], // different port
    ["https://site-a.example", false], // different scheme
  ])("origin %s allowed=%s", async (origin, allowed) => {
    if (allowed) {
      const result = await createWebchatSession(ctx.publicId, undefined, origin);
      expect(result.session).toBeTruthy();
    } else {
      await expect(createWebchatSession(ctx.publicId, undefined, origin)).rejects.toThrow();
    }
  });
});

describe("WebChat Step 2B — Provider Isolation", () => {
  test("webchat resolves its own outbound adapter", () => {
    const adapter = providerDispatcher.resolve("webchat");
    expect(adapter).toBeInstanceOf(WebChatOutboundAdapter);
  });

  test("whatsapp and instagram still resolve their own adapters", () => {
    expect(providerDispatcher.resolve("whatsapp")).not.toBeInstanceOf(WebChatOutboundAdapter);
    expect(providerDispatcher.resolve("instagram")).not.toBeInstanceOf(WebChatOutboundAdapter);
  });
});

describe("WebChat Step 2B — History Pagination & Polling", () => {
  let ctx: TestWidget;
  let session: any;

  beforeAll(async () => {
    ctx = await setupWidget();
    const created = await createWebchatSession(ctx.publicId, undefined, ORIGIN);
    session = created.session;

    for (let i = 0; i < 3; i++) {
      const { conversationId } = await handleWebchatInboundMessage(session, randomUUID(), `Msg ${i}`);
      session.conversationId = conversationId;
    }
  });

  afterAll(async () => {
    await cleanupWidget(ctx);
  });

  test("history respects limit and deduplicates across repeated polls", async () => {
    const first = await getWebchatHistory(session, 2);
    const second = await getWebchatHistory(session, 2);

    expect(first.length).toBe(2);
    expect(second.length).toBe(2);
    expect(first.map((m) => m.id)).toEqual(second.map((m) => m.id));
  });

  test("history order is ascending", async () => {
    const all = await getWebchatHistory(session, 50);
    expect(all.length).toBe(3);
    for (let i = 1; i < all.length; i++) {
      expect(new Date(all[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(all[i - 1].createdAt).getTime());
    }
  });
});
