/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { listContactsForUser, getContactDetailForUser } from "@/lib/services/contacts.service";

describe("CRM WebChat contact pages", () => {
  const tenantId = randomUUID();
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);
  const ORIGIN = "http://localhost:3000";

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'WebChat CRM Test')`,
      [channelId, tenantId, `ext-${publicId}`],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins, prechat_enabled)
       VALUES (?, ?, ?, ?, 1, 'CRM Test', ?, 1)`,
      [widgetId, tenantId, channelId, publicId, JSON.stringify([ORIGIN])],
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM direct_messages WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contact_identities WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contacts WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [widgetId]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [channelId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  test("getContactDetailForUser loads WebChat history by wc_<visitorId> without phone_e164", async () => {
    const visitorId = randomUUID();
    const prechat = { name: "Maria WebChat", email: "maria@example.com", phone: "21999998888" };

    const { session } = await createWebchatSession(publicId, visitorId, ORIGIN, prechat);
    expect(session.contactIdentityId).toBeTruthy();

    const contactRows = (await db.query(
      `SELECT c.id, c.phone_e164, c.whatsapp_number, ci.external_id
       FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE c.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?
       LIMIT 1`,
      [tenantId, visitorId],
    )) as any[];
    expect(contactRows.length).toBe(1);
    const contact = contactRows[0];
    expect(contact.phone_e164).toBeNull();
    expect(contact.whatsapp_number).toBe("5521999998888");

    await handleWebchatInboundMessage(session, randomUUID(), "Olá da Maria!");

    const detail = await getContactDetailForUser(tenantId, contact.id);
    expect(detail.contact.id).toBe(contact.id);
    expect(detail.contact.webchat_external_id).toBe(visitorId);
    expect(detail.messages.length).toBeGreaterThan(0);
    expect(detail.messages[0].body).toBe("Olá da Maria!");
  });

  test("getContactDetailForUser keeps WebChat contacts isolated by visitor id", async () => {
    const visitorA = randomUUID();
    const visitorB = randomUUID();

    const { session: sessionA } = await createWebchatSession(publicId, visitorA, ORIGIN, {
      name: "Contato A",
      email: "a@example.com",
      phone: "11911111111",
    });
    const { session: sessionB } = await createWebchatSession(publicId, visitorB, ORIGIN, {
      name: "Contato B",
      email: "b@example.com",
      phone: "11922222222",
    });

    const [contactA, contactB] = await Promise.all([
      getContactIdByVisitor(tenantId, visitorA),
      getContactIdByVisitor(tenantId, visitorB),
    ]);

    await handleWebchatInboundMessage(sessionA, randomUUID(), "msg A");
    await handleWebchatInboundMessage(sessionB, randomUUID(), "msg B");

    const detailA = await getContactDetailForUser(tenantId, contactA);
    const detailB = await getContactDetailForUser(tenantId, contactB);

    expect(detailA.messages.length).toBeGreaterThan(0);
    expect(detailB.messages.length).toBeGreaterThan(0);
    expect(detailA.messages.map((m: any) => m.body)).toContain("msg A");
    expect(detailA.messages.map((m: any) => m.body)).not.toContain("msg B");
    expect(detailB.messages.map((m: any) => m.body)).toContain("msg B");
    expect(detailB.messages.map((m: any) => m.body)).not.toContain("msg A");
  });

  test("listContactsForUser includes WebChat contacts with phone_e164 null", async () => {
    const visitorId = randomUUID();
    const prechat = { name: "João Lista", email: "joao@example.com", phone: "31999998888" };

    await createWebchatSession(publicId, visitorId, ORIGIN, prechat);

    const contacts = await listContactsForUser(tenantId);
    const match = contacts.find((c: any) => c.name === "João Lista");
    expect(match).toBeTruthy();
    expect(match.phone_e164).toBeNull();
    expect(match.whatsapp_number).toBe("5531999998888");
    expect(match.channel).toBe("webchat");
  });

  test("getContactDetailForUser still loads WhatsApp contact history by phone_e164", async () => {
    const phone = "5511999999999";
    const contactId = randomUUID();
    await db.query(
      `INSERT INTO contacts (id, tenant_id, user_id, phone_e164, name, channel, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'whatsapp', 'manual', NOW(), NOW())`,
      [contactId, tenantId, tenantId, phone, "WhatsApp Test"],
    );
    await db.query(
      `INSERT INTO direct_messages (id, tenant_id, user_id, contact_phone, direction, type, body, created_at)
       VALUES (?, ?, ?, ?, 'incoming', 'text', 'msg WhatsApp', NOW())`,
      [randomUUID(), tenantId, tenantId, phone],
    );

    const detail = await getContactDetailForUser(tenantId, contactId);
    expect(detail.contact.phone_e164).toBe(phone);
    expect(detail.messages.length).toBeGreaterThan(0);
    expect(detail.messages[0].body).toBe("msg WhatsApp");
  });
});

async function getContactIdByVisitor(tenantId: string, visitorId: string): Promise<string> {
  const rows = (await db.query(
    `SELECT c.id FROM contacts c
     JOIN contact_identities ci ON ci.contact_id = c.id
     WHERE c.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?
     LIMIT 1`,
    [tenantId, visitorId],
  )) as any[];
  return rows[0].id;
}
