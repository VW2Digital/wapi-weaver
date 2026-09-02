import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import {
  applyWebchatStatusAcks,
  parseStatusUpdates,
  MAX_STATUS_UPDATES_PER_REQUEST,
} from "@/lib/webchat/message-status.service";
import type { WebchatSession } from "@/lib/webchat/session.service";

jest.mock("@/lib/cache", () => ({
  redis: {
    incr: jest.fn(async () => 1),
    expire: jest.fn(async () => 1),
    publish: jest.fn(async () => 1),
  },
}));

interface Fixture {
  tenantId: string;
  channelId: string;
  widgetId: string;
  publicId: string;
  contactId: string;
  visitorId: string;
  conversationId: string;
  session: WebchatSession;
}

async function createFixture(): Promise<Fixture> {
  const tenantId = randomUUID();
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);
  const contactId = randomUUID();
  const identityId = randomUUID();
  const conversationId = randomUUID();
  const sessionId = randomUUID();
  const visitorId = randomUUID();

  await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
    tenantId,
    `${tenantId}@test.local`,
    "test",
  ]);
  await db.query(
    `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
     VALUES (?, ?, 'webchat', 'active', ?, 'WebChat Status Test')`,
    [channelId, tenantId, `ext-${publicId}`],
  );
  await db.query(
    `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
     VALUES (?, ?, ?, ?, 1, 'Status Widget', ?)`,
    [widgetId, tenantId, channelId, publicId, JSON.stringify(["http://localhost:3000"])],
  );
  await db.query(
    `INSERT INTO contacts (id, user_id, tenant_id, name, phone_e164, channel, created_at, updated_at)
     VALUES (?, ?, ?, 'Visitante', NULL, 'webchat', NOW(), NOW())`,
    [contactId, tenantId, tenantId],
  );
  await db.query(
    `INSERT INTO contact_identities (id, contact_id, user_id, tenant_id, provider, external_id, phone_e164, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'webchat', ?, NULL, NOW(), NOW())`,
    [identityId, contactId, tenantId, tenantId, visitorId],
  );
  await db.query(
    `INSERT INTO chat_sessions (id, user_id, tenant_id, contact_id, channel_connection_id, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'aguardando', NOW())`,
    [conversationId, tenantId, tenantId, contactId, channelId],
  );
  await db.query(
    `INSERT INTO webchat_sessions
       (id, tenant_id, widget_id, channel_connection_id, visitor_id, contact_identity_id, conversation_id, token_hash, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [
      sessionId,
      tenantId,
      widgetId,
      channelId,
      visitorId,
      identityId,
      conversationId,
      randomUUID().replace(/-/g, ""),
    ],
  );

  const session: WebchatSession = {
    id: sessionId,
    tenantId,
    widgetId,
    channelConnectionId: channelId,
    visitorId,
    conversationId,
    contactIdentityId: identityId,
    status: "active",
    expiresAt: new Date(Date.now() + 86400000),
  };

  return { tenantId, channelId, widgetId, publicId, contactId, visitorId, conversationId, session };
}

async function destroyFixture(fx: Fixture) {
  await db.query(`DELETE FROM direct_messages WHERE tenant_id = ?`, [fx.tenantId]);
  await db.query(`DELETE FROM webchat_sessions WHERE tenant_id = ?`, [fx.tenantId]);
  await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [fx.tenantId]);
  await db.query(`DELETE FROM contact_identities WHERE tenant_id = ?`, [fx.tenantId]);
  await db.query(`DELETE FROM contacts WHERE tenant_id = ?`, [fx.tenantId]);
  await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [fx.widgetId]);
  await db.query(`DELETE FROM channel_connections WHERE id = ?`, [fx.channelId]);
  await db.query(`DELETE FROM users WHERE id = ?`, [fx.tenantId]);
}

async function insertMessage(
  fx: Fixture,
  overrides: {
    direction?: "incoming" | "outgoing";
    status?: string | null;
    channel?: string;
    conversationId?: string | null;
    channelConnectionId?: string | null;
    body?: string;
  } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO direct_messages
       (id, client_message_id, tenant_id, user_id, conversation_id, contact_phone, direction, type, body,
        status, channel, channel_connection_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'text', ?, ?, ?, ?, NOW())`,
    [
      id,
      randomUUID(),
      fx.tenantId,
      fx.tenantId,
      overrides.conversationId === undefined ? fx.conversationId : overrides.conversationId,
      `wc_${fx.visitorId}`,
      overrides.direction ?? "outgoing",
      overrides.body ?? "Mensagem de teste",
      overrides.status === undefined ? "sent" : overrides.status,
      overrides.channel ?? "webchat",
      overrides.channelConnectionId === undefined ? fx.channelId : overrides.channelConnectionId,
    ],
  );
  return id;
}

async function readMessage(id: string) {
  const rows = (await db.query(
    `SELECT id, status, delivered_at, read_at, body, direction FROM direct_messages WHERE id = ?`,
    [id],
  )) as any[];
  return rows[0];
}

describe("WebChat Step 3 — payload validation", () => {
  test("rejects a non-array updates field", () => {
    expect(() => parseStatusUpdates({ updates: "nope" })).toThrow(/must be an array/);
  });

  test("rejects an unknown status", () => {
    expect(() =>
      parseStatusUpdates({ updates: [{ messageId: randomUUID(), status: "sent" }] }),
    ).toThrow(/delivered, read/);
  });

  test("rejects a malformed messageId", () => {
    expect(() => parseStatusUpdates({ updates: [{ messageId: "abc", status: "read" }] })).toThrow(
      /valid `messageId`/,
    );
  });

  test("rejects an oversized batch", () => {
    const updates = Array.from({ length: MAX_STATUS_UPDATES_PER_REQUEST + 1 }, () => ({
      messageId: randomUUID(),
      status: "delivered",
    }));
    expect(() => parseStatusUpdates({ updates })).toThrow(/At most/);
  });

  test("accepts a well formed batch and collapses exact duplicates", () => {
    const id = randomUUID();
    const parsed = parseStatusUpdates({
      updates: [
        { messageId: id, status: "delivered" },
        { messageId: id, status: "delivered" },
        { messageId: id, status: "read" },
      ],
    });
    expect(parsed).toEqual([
      { messageId: id, status: "delivered" },
      { messageId: id, status: "read" },
    ]);
  });

  test("accepts an empty batch", () => {
    expect(parseStatusUpdates({ updates: [] })).toEqual([]);
  });
});

describe("WebChat Step 3 — status transitions", () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await createFixture();
  });

  afterAll(async () => {
    await destroyFixture(fx);
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM direct_messages WHERE tenant_id = ?`, [fx.tenantId]);
  });

  test("sent -> delivered sets status and delivered_at", async () => {
    const id = await insertMessage(fx);
    const result = await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);

    expect(result.updated).toEqual([id]);
    const row = await readMessage(id);
    expect(row.status).toBe("delivered");
    expect(row.delivered_at).not.toBeNull();
    expect(row.read_at).toBeNull();
  });

  test("delivered -> read sets read_at and keeps delivered_at", async () => {
    const id = await insertMessage(fx);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);
    const afterDelivered = await readMessage(id);

    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);
    const afterRead = await readMessage(id);

    expect(afterRead.status).toBe("read");
    expect(afterRead.read_at).not.toBeNull();
    expect(new Date(afterRead.delivered_at).getTime()).toBe(
      new Date(afterDelivered.delivered_at).getTime(),
    );
  });

  test("sent -> read jumps straight to read and backfills delivered_at", async () => {
    const id = await insertMessage(fx);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);

    const row = await readMessage(id);
    expect(row.status).toBe("read");
    expect(row.read_at).not.toBeNull();
    expect(row.delivered_at).not.toBeNull();
    expect(new Date(row.delivered_at).getTime()).toBeLessThanOrEqual(
      new Date(row.read_at).getTime(),
    );
  });

  test("read -> delivered is blocked (out-of-order ACK)", async () => {
    const id = await insertMessage(fx);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);

    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: id, status: "delivered" },
    ]);

    expect(result.updated).toEqual([]);
    expect(result.unchanged).toEqual([id]);
    const row = await readMessage(id);
    expect(row.status).toBe("read");
  });

  test("duplicate delivered ACKs are idempotent", async () => {
    const id = await insertMessage(fx);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);
    const first = await readMessage(id);

    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);
    const last = await readMessage(id);

    expect(last.status).toBe("delivered");
    expect(new Date(last.delivered_at).getTime()).toBe(new Date(first.delivered_at).getTime());
  });

  test("duplicate read ACKs preserve the original read_at", async () => {
    const id = await insertMessage(fx);
    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);
    const first = await readMessage(id);

    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);
    const last = await readMessage(id);

    expect(last.status).toBe("read");
    expect(new Date(last.read_at).getTime()).toBe(new Date(first.read_at).getTime());
  });

  test("delivered and read in the same batch settle on read", async () => {
    const id = await insertMessage(fx);
    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: id, status: "delivered" },
      { messageId: id, status: "read" },
    ]);

    expect(result.updated).toEqual([id]);
    const row = await readMessage(id);
    expect(row.status).toBe("read");
  });

  test("concurrent delivered and read never regress below read", async () => {
    const id = await insertMessage(fx);
    await Promise.all([
      applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]),
      applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]),
      applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]),
    ]);

    const row = await readMessage(id);
    expect(row.status).toBe("read");
  });

  test("a batch updates several messages at once", async () => {
    const a = await insertMessage(fx);
    const b = await insertMessage(fx);
    const c = await insertMessage(fx);

    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: a, status: "delivered" },
      { messageId: b, status: "delivered" },
      { messageId: c, status: "delivered" },
    ]);

    expect(result.updated.sort()).toEqual([a, b, c].sort());
    for (const id of [a, b, c]) {
      expect((await readMessage(id)).status).toBe("delivered");
    }
  });
});

describe("WebChat Step 3 — ACK ownership and isolation", () => {
  let fx: Fixture;
  let other: Fixture;

  beforeAll(async () => {
    fx = await createFixture();
    other = await createFixture();
  });

  afterAll(async () => {
    await destroyFixture(fx);
    await destroyFixture(other);
  });

  test("an incoming message can never be ACKed", async () => {
    const id = await insertMessage(fx, { direction: "incoming", status: null });
    const result = await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([id]);
    expect((await readMessage(id)).status).toBeNull();
  });

  test("a message from another tenant is rejected", async () => {
    const foreignId = await insertMessage(other);
    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: foreignId, status: "read" },
    ]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([foreignId]);
    expect((await readMessage(foreignId)).status).toBe("sent");
  });

  test("a message from another widget of the same tenant is rejected", async () => {
    const otherChannelId = randomUUID();
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'Second Widget')`,
      [otherChannelId, fx.tenantId, `ext-second-${otherChannelId.slice(0, 8)}`],
    );

    const id = await insertMessage(fx, { channelConnectionId: otherChannelId });
    const result = await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([id]);
    expect((await readMessage(id)).status).toBe("sent");

    await db.query(`DELETE FROM direct_messages WHERE id = ?`, [id]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [otherChannelId]);
  });

  test("a message from another conversation is rejected", async () => {
    const id = await insertMessage(fx, { conversationId: randomUUID() });
    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: id, status: "delivered" },
    ]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([id]);
  });

  test("a non-webchat message is rejected even inside the same conversation", async () => {
    const id = await insertMessage(fx, { channel: "whatsapp" });
    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: id, status: "delivered" },
    ]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([id]);
    expect((await readMessage(id)).status).toBe("sent");
  });

  test("an unknown messageId is rejected and never creates a row", async () => {
    const ghost = randomUUID();
    const before = (await db.query(
      `SELECT COUNT(*) as n FROM direct_messages WHERE tenant_id = ?`,
      [fx.tenantId],
    )) as any[];

    const result = await applyWebchatStatusAcks(fx.session, [
      { messageId: ghost, status: "delivered" },
    ]);

    const after = (await db.query(
      `SELECT COUNT(*) as n FROM direct_messages WHERE tenant_id = ?`,
      [fx.tenantId],
    )) as any[];

    expect(result.rejected).toEqual([ghost]);
    expect(after[0].n).toBe(before[0].n);
  });

  test("a session without a conversation cannot ACK anything", async () => {
    const id = await insertMessage(fx);
    const orphanSession = { ...fx.session, conversationId: null };

    const result = await applyWebchatStatusAcks(orphanSession, [
      { messageId: id, status: "read" },
    ]);

    expect(result.updated).toEqual([]);
    expect(result.rejected).toEqual([id]);
    expect((await readMessage(id)).status).toBe("sent");
  });
});

describe("WebChat Step 3 — ACKs have no side effects", () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await createFixture();
  });

  afterAll(async () => {
    await destroyFixture(fx);
  });

  test("an ACK does not create messages, alter the body or touch unread", async () => {
    const id = await insertMessage(fx, { body: "Conteudo original" });

    await db.query(`UPDATE contacts SET is_unread = 0 WHERE id = ?`, [fx.contactId]);

    const messagesBefore = (await db.query(
      `SELECT COUNT(*) as n FROM direct_messages WHERE tenant_id = ?`,
      [fx.tenantId],
    )) as any[];

    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "read" }]);

    const messagesAfter = (await db.query(
      `SELECT COUNT(*) as n FROM direct_messages WHERE tenant_id = ?`,
      [fx.tenantId],
    )) as any[];
    const contact = (await db.query(`SELECT is_unread FROM contacts WHERE id = ?`, [
      fx.contactId,
    ])) as any[];
    const row = await readMessage(id);

    expect(messagesAfter[0].n).toBe(messagesBefore[0].n);
    expect(row.body).toBe("Conteudo original");
    expect(Number(contact[0].is_unread)).toBe(0);
  });

  test("an ACK does not create a conversation", async () => {
    const id = await insertMessage(fx);
    const before = (await db.query(`SELECT COUNT(*) as n FROM chat_sessions WHERE tenant_id = ?`, [
      fx.tenantId,
    ])) as any[];

    await applyWebchatStatusAcks(fx.session, [{ messageId: id, status: "delivered" }]);

    const after = (await db.query(`SELECT COUNT(*) as n FROM chat_sessions WHERE tenant_id = ?`, [
      fx.tenantId,
    ])) as any[];
    expect(after[0].n).toBe(before[0].n);
  });
});
