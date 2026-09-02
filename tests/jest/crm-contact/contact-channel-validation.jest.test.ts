/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { contactInput, updateContactInput } from "@/lib/contacts.schema";
import {
  createContactForUser,
  updateContactForUser,
  getContactDetailForUser,
} from "@/lib/services/contacts.service";

describe("CRM contact channel validation", () => {
  const tenantId = randomUUID();

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM contacts WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  describe("schema validation", () => {
    test.each([
      ["whatsapp", true],
      ["instagram", true],
      ["messenger", true],
      ["webchat", true],
      ["telegram", false],
    ] as const)("contactInput channel=%s accepted=%s", (channel, accepted) => {
      const result = contactInput.safeParse({
        phone: channel === "webchat" ? "" : "5511999999999",
        name: "Test",
        channel,
      });
      expect(result.success).toBe(accepted);
    });

    test("updateContactInput accepts webchat", () => {
      const result = updateContactInput.safeParse({
        id: "00000000-0000-0000-0000-000000000000",
        phone: "",
        name: "Test",
        channel: "webchat",
      });
      expect(result.success).toBe(true);
    });

    test("updateContactInput rejects unknown channel", () => {
      const result = updateContactInput.safeParse({
        id: "00000000-0000-0000-0000-000000000000",
        phone: "5511999999999",
        channel: "telegram",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("create contact", () => {
    test.each(["whatsapp", "instagram", "messenger", "webchat"] as const)(
      "create %s contact succeeds",
      async (channel) => {
        const phone = channel === "instagram" ? "ig_123456" : channel === "messenger" ? "fb_123456" : "5511999999999";
        const contact = await createContactForUser(tenantId, {
          phone,
          name: `Create ${channel}`,
          channel,
        });
        expect(contact.channel).toBe(channel);
        expect(contact.name).toBe(`Create ${channel}`);
      },
    );

    test("create webchat contact without phone succeeds", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "",
        name: "WebChat Phoneless",
        channel: "webchat",
      });
      expect(contact.channel).toBe("webchat");
      expect(contact.phone_e164).toBeNull();
      expect(contact.whatsapp_number).toBeNull();
    });

    test("create webchat contact with prechat phone stores phone in whatsapp_number", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "+55 21 99999-8888",
        name: "WebChat Prechat",
        channel: "webchat",
      });
      expect(contact.channel).toBe("webchat");
      expect(contact.phone_e164).toBeNull();
      expect(contact.whatsapp_number).toBe("5521999998888");
    });

    test("create whatsapp contact without phone fails", async () => {
      await expect(
        createContactForUser(tenantId, { phone: "", name: "No Phone", channel: "whatsapp" }),
      ).rejects.toThrow("Telefone");
    });
  });

  describe("update contact", () => {
    test("update webchat contact preserves channel and external ids", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "",
        name: "WebChat Edit",
        channel: "webchat",
        external_contact_id: "wc-visitor-123",
        external_id: "visitor-123",
      });

      const updated = await updateContactForUser(tenantId, {
        id: contact.id,
        phone: "",
        name: "WebChat Edit Updated",
      });

      expect(updated.channel).toBe("webchat");
      expect(updated.external_contact_id).toBe("wc-visitor-123");
      expect(updated.external_id).toBe("visitor-123");
    });

    test("update webchat contact preserves phone_e164 null and adds whatsapp_number", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "",
        name: "WebChat Phone",
        channel: "webchat",
      });

      const updated = await updateContactForUser(tenantId, {
        id: contact.id,
        phone: "+55 31 98888-7777",
        name: "WebChat Phone Updated",
      });

      expect(updated.phone_e164).toBeNull();
      expect(updated.whatsapp_number).toBe("5531988887777");
    });

    test("update webchat contact keeps custom fields when not sent", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "",
        name: "WebChat Custom",
        channel: "webchat",
        custom_fields: { profissao: "Advogada" },
      });

      const updated = await updateContactForUser(tenantId, {
        id: contact.id,
        phone: "",
        name: "WebChat Custom Updated",
      });

      const parsed = (typeof updated.custom_fields === "string" ? JSON.parse(updated.custom_fields) : updated.custom_fields) || {};
      expect(parsed.profissao).toBe("Advogada");
    });

    test("update webchat contact updates custom field", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "",
        name: "WebChat Custom",
        channel: "webchat",
        custom_fields: { profissao: "Advogada" },
      });

      const updated = await updateContactForUser(tenantId, {
        id: contact.id,
        phone: "",
        name: "WebChat Custom Updated",
        custom_fields: { profissao: "Médica" },
      });

      const parsed = (typeof updated.custom_fields === "string" ? JSON.parse(updated.custom_fields) : updated.custom_fields) || {};
      expect(parsed.profissao).toBe("Médica");
    });

    test("update whatsapp contact keeps existing phone if empty", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "+55 11 97777-6666",
        name: "WhatsApp Keep Phone",
        channel: "whatsapp",
      });

      const updated = await updateContactForUser(tenantId, {
        id: contact.id,
        phone: "",
        name: "WhatsApp Keep Phone Updated",
      });

      expect(updated.phone_e164).toBe("5511977776666");
      expect(updated.channel).toBe("whatsapp");
    });
  });

  describe("regression", () => {
    test("whatsapp contact detail still loads messages by phone_e164", async () => {
      const contact = await createContactForUser(tenantId, {
        phone: "+55 11 96666-5555",
        name: "WhatsApp Regression",
        channel: "whatsapp",
      });

      await db.query(
        `INSERT INTO direct_messages (id, tenant_id, user_id, contact_phone, direction, type, body, created_at)
         VALUES (?, ?, ?, ?, 'incoming', 'text', 'msg', NOW())`,
        [randomUUID(), tenantId, tenantId, contact.phone_e164],
      );

      const detail = await getContactDetailForUser(tenantId, contact.id);
      expect(detail.contact.channel).toBe("whatsapp");
      expect(detail.messages.length).toBeGreaterThan(0);
    });
  });
});
