import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createContactForUser } from "@/lib/services/contacts.service";
import {
  listLeadFields,
  getLeadFieldValue,
  setLeadFieldValue,
  LeadFieldError,
} from "@/lib/services/lead-field.service";

describe("Lead Field Service", () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  beforeAll(async () => {
    for (const id of [tenantId, otherTenantId]) {
      await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
        id,
        `${id}@test.local`,
        "test",
      ]);
    }
  });

  afterAll(async () => {
    await db.query(`DELETE FROM contact_custom_field_values WHERE user_id IN (?, ?)`, [
      tenantId,
      otherTenantId,
    ]);
    await db.query(`DELETE FROM contact_custom_fields WHERE user_id IN (?, ?)`, [tenantId, otherTenantId]);
    await db.query(`DELETE FROM contact_identities WHERE user_id IN (?, ?)`, [tenantId, otherTenantId]);
    await db.query(`DELETE FROM contacts WHERE user_id IN (?, ?)`, [tenantId, otherTenantId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [tenantId, otherTenantId]);
  });

  async function createDefinition(
    type: string,
    label: string,
    key: string,
    options?: string[],
  ): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, options, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 1, 0)`,
      [id, tenantId, tenantId, label, key, type, options ? JSON.stringify(options) : null],
    );
    return id;
  }

  test("listLeadFields returns standard fields plus active tenant custom fields", async () => {
    const key = `plano_${randomUUID().slice(0, 8)}`;
    await createDefinition("select", "Plano", key, ["Basic", "Premium"]);

    const fields = await listLeadFields(tenantId);
    const standardKeys = fields.filter((f) => f.kind === "standard").map((f) => f.key);
    expect(standardKeys).toContain("name");
    expect(standardKeys).toContain("email");
    expect(standardKeys).toContain("phone");

    const custom = fields.find((f) => f.kind === "custom" && f.key === key);
    expect(custom).toBeTruthy();
    expect(custom?.type).toBe("select");
    expect(custom?.options).toEqual(["Basic", "Premium"]);
  });

  test("inactive custom field is excluded from listLeadFields", async () => {
    const key = `inativo_${randomUUID().slice(0, 8)}`;
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, 'Inativo', ?, 'text', 0, 1, 1, 0, 0)`,
      [randomUUID(), tenantId, tenantId, key],
    );

    const fields = await listLeadFields(tenantId);
    expect(fields.find((f) => f.key === key)).toBeUndefined();
  });

  test("set and get standard fields", async () => {
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 91111-0001",
      name: "A",
    });

    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "name" }, "Maria Silva");
    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "email" }, "maria@test.com");
    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "company" }, "Acme");
    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "position" }, "Gerente");
    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "notes" }, "Nota");

    expect(await getLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "name" })).toBe("Maria Silva");
    expect(await getLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "email" })).toBe("maria@test.com");
    expect(await getLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "company" })).toBe("Acme");
  });

  test("set invalid email throws", async () => {
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 92222-0002",
      name: "B",
    });

    await expect(
      setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "email" }, "not-email"),
    ).rejects.toThrow("E-mail inválido");
  });

  test("phone update normalizes and preserves channel (webchat)", async () => {
    const contact = await createContactForUser(tenantId, {
      channel: "webchat",
      phone: null,
      name: "C",
    });
    // simulate webchat contact with whatsapp_number prechat phone and phone_e164 null
    await db.query(
      "UPDATE contacts SET phone_e164 = NULL, whatsapp_number = '5511988887777', channel = 'webchat' WHERE id = ?",
      [contact.id],
    );

    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "phone" }, "+55 11 97777-8888");

    const rows = (await db.query("SELECT phone_e164, whatsapp_number, channel FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{ phone_e164: string | null; whatsapp_number: string | null; channel: string }>;
    expect(rows[0].channel).toBe("webchat");
    expect(rows[0].phone_e164).toBeNull();
    expect(rows[0].whatsapp_number).toBe("5511977778888");
  });

  test("phone update on whatsapp contact sets phone_e164 and whatsapp_number", async () => {
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 93333-0003",
      name: "D",
    });

    await setLeadFieldValue(tenantId, contact.id, { kind: "standard", field: "phone" }, "+55 11 96666-9999");

    const rows = (await db.query("SELECT phone_e164, whatsapp_number FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{ phone_e164: string | null; whatsapp_number: string | null }>;
    expect(rows[0].phone_e164).toBe("5511966669999");
    expect(rows[0].whatsapp_number).toBe("5511966669999");
  });

  test("set and get custom field by definition id", async () => {
    const key = `orcamento_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("number", "Orçamento", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 94444-0004",
      name: "E",
    });

    await setLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId }, 75000);

    const value = await getLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId });
    expect(value).toBe(75000);
  });

  test("invalid select option is rejected", async () => {
    const key = `plano_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("select", "Plano", key, ["Basic", "Premium"]);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 95555-0005",
      name: "F",
    });

    await expect(
      setLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId }, "Banana"),
    ).rejects.toThrow();
  });

  test("inactive custom field read/write throws LEAD_FIELD_UNAVAILABLE", async () => {
    const key = `inativo2_${randomUUID().slice(0, 8)}`;
    const defId = randomUUID();
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, 'Inativo2', ?, 'text', 0, 1, 1, 0, 0)`,
      [defId, tenantId, tenantId, key],
    );
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 96666-0006",
      name: "G",
    });

    await expect(
      setLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId }, "x"),
    ).rejects.toThrow("inativo");
  });

  test("cross-tenant custom field is blocked", async () => {
    const key = `outro_${randomUUID().slice(0, 8)}`;
    const defId = randomUUID();
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, 'Outro', ?, 'text', 0, 1, 1, 1, 0)`,
      [defId, otherTenantId, otherTenantId, key],
    );
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 97777-0007",
      name: "H",
    });

    await expect(
      setLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId }, "x"),
    ).rejects.toThrow();
  });

  test("custom field rename keeps definition id stable", async () => {
    const key = `plano_old_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("text", "Plano Old", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 98888-0008",
      name: "I",
    });

    await setLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId }, "Premium");

    await db.query("UPDATE contact_custom_fields SET label = ?, `key` = ? WHERE id = ?", [
      "Plano Novo",
      `${key}_renamed`,
      defId,
    ]);

    const value = await getLeadFieldValue(tenantId, contact.id, { kind: "custom", field: defId });
    expect(value).toBe("Premium");
  });
});
