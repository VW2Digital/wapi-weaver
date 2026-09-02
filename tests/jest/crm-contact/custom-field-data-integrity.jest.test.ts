import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import {
  setContactFieldValues,
  getContactFieldValues,
  getContactFieldValuesBatch,
  validateCustomFieldValue,
  CustomFieldDefinition,
} from "@/lib/services/contact-custom-field.service";
import { createContactForUser, updateContactForUser } from "@/lib/services/contacts.service";
import { ensureContact } from "@/lib/messaging/services/contact-identity.service";
import { executeSaveVariable, BotFlowExecutionContext } from "@/lib/botflow-control";

describe("CRM custom field data integrity", () => {
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
    await db.query(`DELETE FROM contact_custom_fields WHERE user_id IN (?, ?)`, [
      tenantId,
      otherTenantId,
    ]);
    await db.query(`DELETE FROM contact_identities WHERE user_id IN (?, ?)`, [
      tenantId,
      otherTenantId,
    ]);
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

  function uniqueKey(prefix: string): string {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  }

  function buildContext(contact: { id: string; phone_e164: string }): BotFlowExecutionContext {
    return {
      tenantId,
      userId: tenantId,
      contact: { id: contact.id, phone: contact.phone_e164, customFields: {} },
      message: {},
      channel: "whatsapp",
      variables: {},
    };
  }

  test("partial update preserves unrelated fields", async () => {
    const keyA = uniqueKey("profissao");
    const keyB = uniqueKey("plano");
    const keyC = uniqueKey("cidade");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const fieldB = await createDefinition("text", "Plano", keyB);
    const fieldC = await createDefinition("text", "Cidade", keyC);

    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 98888-7777",
      name: "Alice",
    });

    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldA, value: "Advogado" },
      { custom_field_id: fieldB, value: "Premium" },
      { custom_field_id: fieldC, value: "Belém" },
    ]);

    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldB, value: "Enterprise" },
    ]);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[keyA]).toBe("Advogado");
    expect(values[keyB]).toBe("Enterprise");
    expect(values[keyC]).toBe("Belém");
  });

  test("explicit clear removes value without touching others", async () => {
    const keyA = uniqueKey("profissao");
    const keyB = uniqueKey("plano");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const fieldB = await createDefinition("text", "Plano", keyB);

    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 97777-6666",
      name: "Bob",
    });

    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldA, value: "Médico" },
      { custom_field_id: fieldB, value: "Basic" },
    ]);

    await setContactFieldValues(tenantId, contact.id, [{ custom_field_id: fieldB, value: null }]);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[keyA]).toBe("Médico");
    expect(values[keyB]).toBeUndefined();

    const rows = (await db.query(
      "SELECT * FROM contact_custom_field_values WHERE user_id = ? AND contact_id = ? AND custom_field_id = ?",
      [tenantId, contact.id, fieldB],
    )) as Array<{ custom_field_id: string }>;
    expect(rows[0]).toBeUndefined();
  });

  test("ensureContact does not erase existing custom fields or name", async () => {
    const keyA = uniqueKey("profissao");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 96666-5555",
      name: "Carlos Manual",
    });
    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldA, value: "Engenheiro" },
    ]);

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: {
        externalId: "wa-123",
        name: "WhatsApp Override",
        avatarUrl: "https://avatar.test/a.png",
        phoneE164: "+55 11 96666-5555",
      },
      phoneE164: "5511966665555",
    });

    const rows = (await db.query("SELECT name, custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      name: string;
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const row = rows[0];
    expect(row.name).toBe("Carlos Manual");

    const cf =
      typeof row.custom_fields === "string" ? JSON.parse(row.custom_fields) : row.custom_fields;
    expect(cf[keyA]).toBe("Engenheiro");
    expect(cf.avatar_url).toBe("https://avatar.test/a.png");
  });

  test("ensureContact merges multiple provider metadata keys", async () => {
    const keyA = uniqueKey("segmento");
    const fieldA = await createDefinition("text", "Segmento", keyA);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 95555-4444",
      name: "Diana",
    });
    await setContactFieldValues(tenantId, contact.id, [{ custom_field_id: fieldA, value: "VIP" }]);

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: { externalId: "wa-1", phoneE164: "+55 11 95555-4444" },
      phoneE164: "5511955554444",
      metadata: { wa_id: "WA_1", display_phone_number: "+55 11 95555-4444" },
    });

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: { externalId: "wa-1", phoneE164: "+55 11 95555-4444" },
      phoneE164: "5511955554444",
      metadata: { source: "whatsapp_inbound" },
    });

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf[keyA]).toBe("VIP");
    expect(cf.wa_id).toBe("WA_1");
    expect(cf.display_phone_number).toBe("+55 11 95555-4444");
    expect(cf.source).toBe("whatsapp_inbound");
  });

  test("updateContactForUser syncs custom fields to canonical table", async () => {
    const keyA = uniqueKey("profissao");
    await createDefinition("text", "Profissão", keyA);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 94444-3333",
      name: "Eva",
    });

    await updateContactForUser(tenantId, {
      id: contact.id,
      phone: contact.phone_e164,
      custom_fields: { [keyA]: "Arquiteta", avatar_url: "https://avatar.test/e.png" },
    });

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[keyA]).toBe("Arquiteta");

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf[keyA]).toBe("Arquiteta");
    expect(cf.avatar_url).toBe("https://avatar.test/e.png");
  });

  test("bot save variable writes canonical field and preserves existing fields", async () => {
    const keyA = uniqueKey("profissao");
    const keyB = uniqueKey("orcamento");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const fieldB = await createDefinition("number", "Orçamento", keyB);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 93333-2222",
      name: "Fernando",
    });

    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldA, value: "Designer" },
    ]);

    const ctx = buildContext(contact);
    await executeSaveVariable({ key: keyB, value: "50000", scope: "contact" }, ctx, db);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[keyA]).toBe("Designer");
    expect(values[keyB]).toBe(50000);
  });

  test("bot legacy unknown variable is preserved; new unknown variable is rejected", async () => {
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 92222-1111",
      name: "Gustavo",
    });
    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify({ existing_key: "keep" }),
      contact.id,
    ]);

    const ctx = buildContext(contact);
    await executeSaveVariable({ key: "existing_key", value: "updated", scope: "contact" }, ctx, db);

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf.existing_key).toBe("updated");

    await expect(
      executeSaveVariable({ key: "brand_new_key", value: "ok", scope: "contact" }, ctx, db),
    ).rejects.toThrow("Chave de variável inválida");
  });

  test("cross-tenant field write is blocked", async () => {
    const keyA = uniqueKey("profissao");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const otherContact = await createContactForUser(otherTenantId, {
      phone: "+55 11 91111-0000",
      name: "Other",
    });

    await expect(
      setContactFieldValues(tenantId, otherContact.id, [
        { custom_field_id: fieldA, value: "Hack" },
      ]),
    ).rejects.toThrow("Contato não encontrado");
  });

  test("cross-tenant definition cannot be used", async () => {
    const otherKey = uniqueKey("outro");
    const otherId = randomUUID();
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, 'Outro', ?, 'text', 0, 1, 1, 1, 0)`,
      [otherId, otherTenantId, otherTenantId, otherKey],
    );

    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 90000-9999",
      name: "Hacker",
    });

    await expect(
      setContactFieldValues(tenantId, contact.id, [{ custom_field_id: otherId, value: "X" }]),
    ).rejects.toThrow("não encontrada");
  });

  test("type validation rejects invalid values", async () => {
    const key = uniqueKey("orcamento");
    const numberField = await createDefinition("number", "Orçamento", key);
    const rows = (await db.query(
      "SELECT * FROM contact_custom_fields WHERE id = ? AND user_id = ? LIMIT 1",
      [numberField, tenantId],
    )) as CustomFieldDefinition[];
    const def = rows[0];

    const invalid = validateCustomFieldValue(def, "banana");
    expect(invalid.ok).toBe(false);

    const valid = validateCustomFieldValue(def, "1.234,56");
    expect(valid.ok).toBe(true);
    expect(valid.normalized).toBe(1234.56);
  });

  test("select validation rejects unauthorized option", async () => {
    const key = uniqueKey("status");
    const selectField = await createDefinition("select", "Status", key, ["A", "B", "C"]);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 88888-7777",
      name: "Hugo",
    });

    await expect(
      setContactFieldValues(tenantId, contact.id, [{ custom_field_id: selectField, value: "D" }]),
    ).rejects.toThrow("inválido");
  });

  test("prototype pollution keys are rejected", async () => {
    const rows = (await db.query("SELECT * FROM contact_custom_fields WHERE user_id = ? LIMIT 1", [
      tenantId,
    ])) as CustomFieldDefinition[];
    expect(rows[0]).toBeTruthy();

    const def = { ...rows[0], key: "__proto__" } as CustomFieldDefinition;
    const result = validateCustomFieldValue(def, "x");
    expect(result.ok).toBe(false);
  });

  test("batch read returns canonical values", async () => {
    const key = uniqueKey("batch");
    const fieldA = await createDefinition("text", "Batch", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 87777-6666",
      name: "Igor",
    });
    await setContactFieldValues(tenantId, contact.id, [
      { custom_field_id: fieldA, value: "BatchValue" },
    ]);

    const batch = await getContactFieldValuesBatch(tenantId, [contact.id]);
    const match = batch.find((r) => r.contact_id === contact.id && r.key === key);
    expect(match?.value).toBe("BatchValue");
  });
});
