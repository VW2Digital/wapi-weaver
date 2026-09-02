import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";

describe("WebChat prechat contact creation", () => {
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
       VALUES (?, ?, 'webchat', 'active', ?, 'Prechat')`,
      [channelId, tenantId, `ext-${publicId}`],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins, prechat_enabled)
       VALUES (?, ?, ?, ?, 1, 'Prechat', ?, 1)`,
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

  test("creates a contact with normalized prechat phone in whatsapp_number and keeps phone_e164 null", async () => {
    const visitorId = randomUUID();
    const prechat = {
      name: "João Silva",
      email: "joao@example.com",
      phone: "11988887777",
    };

    const { session } = await createWebchatSession(publicId, visitorId, ORIGIN, prechat);
    expect(session.contactIdentityId).toBeTruthy();

    const rows = (await db.query(
      `SELECT c.name, c.email, c.phone_e164, c.whatsapp_number, c.custom_fields, ci.external_id, ci.metadata, ci.phone_e164 as identity_phone
       FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE c.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?
       LIMIT 1`,
      [tenantId, visitorId],
    )) as any[];

    expect(rows.length).toBe(1);
    const contact = rows[0];
    expect(contact.name).toBe("João Silva");
    expect(contact.email).toBe("joao@example.com");
    expect(contact.phone_e164).toBeNull();
    expect(contact.whatsapp_number).toBe("5511988887777");
    expect(contact.identity_phone).toBe("5511988887777");
    const customFields =
      typeof contact.custom_fields === "string" ? JSON.parse(contact.custom_fields) : contact.custom_fields;
    expect(customFields).toMatchObject({ phone: "5511988887777", email: "joao@example.com" });
  });

  test("keeps direct_messages.contact_phone as wc_<visitorId> and uses whatsapp_number for display", async () => {
    const visitorId = randomUUID();
    const prechat = {
      name: "Maria Souza",
      email: "maria@example.com",
      phone: "21 99999-8888",
    };

    const { session } = await createWebchatSession(publicId, visitorId, ORIGIN, prechat);
    const result = await handleWebchatInboundMessage(session, randomUUID(), "Olá!");

    expect(result.messageId).toBeTruthy();

    const msgRows = (await db.query(
      `SELECT contact_phone FROM direct_messages WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [result.messageId, tenantId],
    )) as any[];

    expect(msgRows.length).toBe(1);
    expect(msgRows[0].contact_phone).toBe(`wc_${visitorId}`);

    const contactRows = (await db.query(
      `SELECT c.whatsapp_number FROM contacts c
       JOIN contact_identities ci ON ci.contact_id = c.id
       WHERE c.tenant_id = ? AND ci.provider = 'webchat' AND ci.external_id = ?`,
      [tenantId, visitorId],
    )) as any[];

    expect(contactRows[0].whatsapp_number).toBe("5521999998888");
  });
});
