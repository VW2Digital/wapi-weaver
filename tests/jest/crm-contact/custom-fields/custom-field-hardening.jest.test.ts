import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import {
  setContactFieldValues,
  getContactFieldValues,
  syncContactFieldValuesFromJson,
  sanitizeProviderMetadata,
} from "@/lib/services/contact-custom-field.service";
import { createContactForUser } from "@/lib/services/contacts.service";
import { ensureContact } from "@/lib/messaging/services/contact-identity.service";
import { executeSaveVariable, BotFlowExecutionContext } from "@/lib/botflow-control";

describe("CRM custom field hardening", () => {
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

  test("canonical value wins over legacy JSON", async () => {
    const key = uniqueKey("plano");
    await createDefinition("text", "Plano", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 91111-0001", name: "A" });

    await setContactFieldValues(tenantId, contact.id, [{ key, value: "Premium" }]);
    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify({ [key]: "Basic" }),
      contact.id,
    ]);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Premium");
  });

  test("legacy JSON fallback for defined fields missing in canonical table", async () => {
    const key = uniqueKey("profissao");
    await createDefinition("text", "Profissão", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 92222-0002", name: "B" });

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify({ [key]: "Engenheiro" }),
      contact.id,
    ]);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Engenheiro");
  });

  test("syncContactFieldValuesFromJson ignores unknown keys and invalid types", async () => {
    const key = uniqueKey("orcamento");
    await createDefinition("number", "Orçamento", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 93333-0003", name: "C" });

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify({ [key]: "abc", unknown_key: "x" }),
      contact.id,
    ]);

    await expect(
      syncContactFieldValuesFromJson(tenantId, contact.id, { [key]: "abc", unknown_key: "x" }),
    ).rejects.toThrow();

    // unknown_key não deve ter sido inserido na tabela canônica
    const rows = (await db.query(
      "SELECT * FROM contact_custom_field_values cfv JOIN contact_custom_fields cf ON cfv.custom_field_id = cf.id WHERE cfv.user_id = ? AND cfv.contact_id = ? AND cf.`key` = ?",
      [tenantId, contact.id, "unknown_key"],
    )) as unknown[];
    expect(rows.length).toBe(0);
  });

  test("bot valid custom field writes canonical value", async () => {
    const key = uniqueKey("plano");
    await createDefinition("select", "Plano", key, ["Basic", "Premium"]);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 94444-0004", name: "D" });

    const ctx = buildContext(contact);
    await executeSaveVariable({ key, value: "Premium", scope: "contact" }, ctx, db);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Premium");
  });

  test("bot invalid option is rejected", async () => {
    const key = uniqueKey("plano");
    await createDefinition("select", "Plano", key, ["Basic", "Premium"]);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 95555-0005", name: "E" });

    const ctx = buildContext(contact);
    await expect(
      executeSaveVariable({ key, value: "Banana", scope: "contact" }, ctx, db),
    ).rejects.toThrow("inválido");
  });

  test("bot unknown new key is rejected", async () => {
    const contact = await createContactForUser(tenantId, { phone: "+55 11 96666-0006", name: "F" });

    const ctx = buildContext(contact);
    await expect(
      executeSaveVariable({ key: "unknown_xyz", value: "ok", scope: "contact" }, ctx, db),
    ).rejects.toThrow("Chave de variável inválida");
  });

  test("bot legacy unknown key is preserved with compatibility marker", async () => {
    const contact = await createContactForUser(tenantId, { phone: "+55 11 97777-0007", name: "G" });
    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify({ legacy_var: "old" }),
      contact.id,
    ]);

    const ctx = buildContext(contact);
    await executeSaveVariable({ key: "legacy_var", value: "new", scope: "contact" }, ctx, db);

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf.legacy_var).toBe("new");
  });

  test("bot cross-tenant field write is blocked", async () => {
    const otherKey = uniqueKey("outro");
    const otherDefId = randomUUID();
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, required, show_on_form, show_on_details, is_active, sort_order)
       VALUES (?, ?, ?, 'Outro', ?, 'text', 0, 1, 1, 1, 0)`,
      [otherDefId, otherTenantId, otherTenantId, otherKey],
    );

    const contact = await createContactForUser(tenantId, { phone: "+55 11 98888-0008", name: "H" });
    const ctx = buildContext(contact);

    await expect(
      executeSaveVariable({ key: otherKey, value: "x", scope: "contact" }, ctx, db),
    ).rejects.toThrow();
  });

  test("provider inbound metadata cannot erase CRM custom fields", async () => {
    const key = uniqueKey("profissao");
    await createDefinition("text", "Profissão", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 99999-0009", name: "I" });
    await setContactFieldValues(tenantId, contact.id, [{ key, value: "Advogado" }]);

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: { externalId: "wa-1", phoneE164: "+55 11 99999-0009" },
      phoneE164: "5511999990009",
      metadata: { [key]: null, source: "whatsapp_inbound", avatar_url: "https://x.test/a.png" },
    });

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Advogado");

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf[key]).toBe("Advogado");
    expect(cf.source).toBe("whatsapp_inbound");
    expect(cf.avatar_url).toBe("https://x.test/a.png");
  });

  test("provider null for custom field does not delete value (Instagram)", async () => {
    const key = uniqueKey("segmento");
    await createDefinition("text", "Segmento", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 91234-0010", name: "J" });
    await setContactFieldValues(tenantId, contact.id, [{ key, value: "VIP" }]);

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "instagram",
      identity: {
        externalId: "ig-1",
        phoneE164: null,
        metadata: { [key]: null, instagram_username: "user" },
      },
      phoneE164: null,
    });

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("VIP");
  });

  test("provider null for custom field does not delete value (WebChat)", async () => {
    const key = uniqueKey("cidade");
    await createDefinition("text", "Cidade", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 92345-0011", name: "K" });
    await setContactFieldValues(tenantId, contact.id, [{ key, value: "Belém" }]);

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "webchat",
      identity: { externalId: "wc-1", phoneE164: null },
      phoneE164: null,
      metadata: { [key]: null, webchat_external_id: "wc-1" },
    });

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Belém");
  });

  test("sequential CRM update and provider inbound preserve both", async () => {
    const key = uniqueKey("plano");
    await createDefinition("text", "Plano", key);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 93456-0012", name: "L" });

    await setContactFieldValues(tenantId, contact.id, [{ key, value: "Premium" }]);
    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: { externalId: "wa-2", phoneE164: "+55 11 93456-0012" },
      phoneE164: "5511934560012",
      metadata: { wa_id: "WA_2", avatar_url: "https://x.test/b.png" },
    });

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[key]).toBe("Premium");

    const rows = (await db.query("SELECT custom_fields FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      custom_fields: string | Record<string, unknown> | null;
    }>;
    const cf =
      typeof rows[0].custom_fields === "string"
        ? JSON.parse(rows[0].custom_fields)
        : rows[0].custom_fields;
    expect(cf[key]).toBe("Premium");
    expect(cf.wa_id).toBe("WA_2");
    expect(cf.avatar_url).toBe("https://x.test/b.png");
  });

  test("concurrent independent custom field updates survive", async () => {
    const keyA = uniqueKey("profissao");
    const keyB = uniqueKey("plano");
    const fieldA = await createDefinition("text", "Profissão", keyA);
    const fieldB = await createDefinition("text", "Plano", keyB);
    const contact = await createContactForUser(tenantId, { phone: "+55 11 94567-0013", name: "M" });

    await Promise.all([
      setContactFieldValues(tenantId, contact.id, [{ custom_field_id: fieldA, value: "Médico" }]),
      setContactFieldValues(tenantId, contact.id, [
        { custom_field_id: fieldB, value: "Enterprise" },
      ]),
    ]);

    const values = await getContactFieldValues(tenantId, contact.id);
    expect(values[keyA]).toBe("Médico");
    expect(values[keyB]).toBe("Enterprise");
  });

  test("sanitizeProviderMetadata rejects tenant custom field keys", () => {
    const tenantKeys = new Set(["profissao"]);
    const raw = {
      profissao: "Hack",
      avatar_url: "https://x.test/c.png",
      source: "whatsapp",
      name: "Meta",
      __proto__: "pollution",
      unknown_key: "x",
    };
    const out = sanitizeProviderMetadata(tenantKeys, raw);
    expect(out).toEqual({
      avatar_url: "https://x.test/c.png",
      source: "whatsapp",
    });
  });

  test("prototype pollution is blocked in all paths", async () => {
    const contact = await createContactForUser(tenantId, { phone: "+55 11 95678-0014", name: "N" });

    await ensureContact({
      tenantId,
      userId: tenantId,
      provider: "whatsapp",
      identity: { externalId: "wa-3", phoneE164: "+55 11 95678-0014" },
      phoneE164: "5511956780014",
      metadata: { __proto__: "pollution", avatar_url: "https://x.test/d.png" },
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
    expect(Object.prototype.hasOwnProperty.call(cf, "__proto__")).toBe(false);
    expect(cf.avatar_url).toBe("https://x.test/d.png");

    const ctx = buildContext(contact);
    await expect(
      executeSaveVariable({ key: "__proto__", value: "x", scope: "contact" }, ctx, db),
    ).rejects.toThrow();
  });

  test("mass assignment does not touch identity columns", async () => {
    const contact = await createContactForUser(tenantId, { phone: "+55 11 96789-0015", name: "O" });
    const ctx = buildContext(contact);

    await expect(
      executeSaveVariable({ key: "tenant_id", value: otherTenantId, scope: "contact" }, ctx, db),
    ).rejects.toThrow("Chave de variável inválida");

    const rows = (await db.query("SELECT tenant_id, user_id FROM contacts WHERE id = ?", [
      contact.id,
    ])) as Array<{
      tenant_id: string;
      user_id: string;
    }>;
    expect(rows[0].tenant_id).toBe(tenantId);
    expect(rows[0].user_id).toBe(tenantId);
  });
});
