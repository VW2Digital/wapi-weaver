/// <reference types="jest" />
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { ensureContact } from "@/lib/messaging/services/contact-identity.service";
import { ensureConversation } from "@/lib/messaging/services/conversation.service";
import { saveMessage } from "@/lib/messaging/services/message.service";
import { updateMessageStatus } from "@/lib/messaging/services/status.service";

const DB_PASSWORD = process.env.DB_PASSWORD;

describe("Messaging integration (requires DB)", () => {
  const runWithDb = DB_PASSWORD ? it : it.skip;

  const testTenantId = randomUUID();
  const phoneNumberId = `PHONE_ID_${randomUUID().slice(0, 8)}`;
  const contactPhone = "5511888888888";

  beforeAll(async () => {
    if (!DB_PASSWORD) return;
    try {
      const email = `${testTenantId.slice(0, 8)}@test.local`;
      await db.query(
        `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
        [testTenantId, email, "hashed"],
      );
      await db.query(
        `INSERT INTO profiles (id, whatsapp_phone_number_id) VALUES (?, ?)`,
        [testTenantId, phoneNumberId],
      );
    } catch (err: any) {
      // If the test tenant already exists, ignore
      if (err.message?.includes("Duplicate")) return;
      throw err;
    }
  });

  afterAll(async () => {
    if (!DB_PASSWORD) return;
    await db.query(`DELETE FROM contact_identities WHERE tenant_id = ?`, [testTenantId]);
    await db.query(`DELETE FROM direct_messages WHERE tenant_id = ?`, [testTenantId]);
    await db.query(`DELETE FROM chat_sessions WHERE tenant_id = ?`, [testTenantId]);
    await db.query(`DELETE FROM contacts WHERE tenant_id = ?`, [testTenantId]);
    await db.query(`DELETE FROM profiles WHERE id = ?`, [testTenantId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [testTenantId]);
  });

  runWithDb("creates contact, conversation and message idempotently", async () => {
    const identity = {
      externalId: `wa-${contactPhone}`,
      name: "Test Contact",
      phoneE164: contactPhone,
      avatarUrl: null,
      metadata: null,
    };

    const contact1 = await ensureContact({
      tenantId: testTenantId,
      userId: testTenantId,
      provider: "whatsapp",
      identity,
      phoneE164: contactPhone,
    });

    const contact2 = await ensureContact({
      tenantId: testTenantId,
      userId: testTenantId,
      provider: "whatsapp",
      identity,
      phoneE164: contactPhone,
    });

    expect(contact1.contactId).toBe(contact2.contactId);
    expect(contact2.isNew).toBe(false);

    const conversation = await ensureConversation({
      tenantId: testTenantId,
      userId: testTenantId,
      contactId: contact1.contactId,
    });

    expect(conversation.sessionId).toBeTruthy();
    expect(conversation.isNew).toBe(true);

    const message = await saveMessage({
      tenantId: testTenantId,
      userId: testTenantId,
      contactId: contact1.contactId,
      contactPhone,
      provider: "whatsapp",
      channelResourceId: phoneNumberId,
      message: {
        providerMessageId: "wamid.integration.001",
        direction: "incoming",
        type: "text",
        body: "Mensagem de integração",
        sender: {
          externalId: contactPhone,
          name: "Test Contact",
          phoneE164: contactPhone,
        },
        recipient: { externalId: phoneNumberId },
      } as any,
    });

    expect(message.isNew).toBe(true);

    const dupMessage = await saveMessage({
      tenantId: testTenantId,
      userId: testTenantId,
      contactId: contact1.contactId,
      contactPhone,
      provider: "whatsapp",
      channelResourceId: phoneNumberId,
      message: {
        providerMessageId: "wamid.integration.001",
        direction: "incoming",
        type: "text",
        body: "Mensagem de integração",
        sender: { externalId: contactPhone },
        recipient: { externalId: phoneNumberId },
      } as any,
    });

    expect(dupMessage.isNew).toBe(false);
    expect(dupMessage.messageId).toBe(message.messageId);
  });

  runWithDb("updates message status without regressing", async () => {
    const providerMessageId = "wamid.integration.status";

    await saveMessage({
      tenantId: testTenantId,
      userId: testTenantId,
      contactId: "any",
      contactPhone,
      provider: "whatsapp",
      channelResourceId: phoneNumberId,
      message: {
        providerMessageId,
        direction: "outgoing",
        type: "text",
        body: "Status test",
        sender: { externalId: phoneNumberId },
        recipient: { externalId: contactPhone, phoneE164: contactPhone },
      } as any,
    });

    const delivered = await updateMessageStatus({
      tenantId: testTenantId,
      userId: testTenantId,
      providerMessageId,
      status: "delivered",
    });

    expect(delivered.updated).toBe(true);

    const sent = await updateMessageStatus({
      tenantId: testTenantId,
      userId: testTenantId,
      providerMessageId,
      status: "sent",
    });

    // Should not regress from delivered to sent
    expect(sent.updated).toBe(false);

    const read = await updateMessageStatus({
      tenantId: testTenantId,
      userId: testTenantId,
      providerMessageId,
      status: "read",
    });

    expect(read.updated).toBe(true);
  });
});
