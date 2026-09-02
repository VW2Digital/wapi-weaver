import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createContactForUser } from "@/lib/services/contacts.service";
import {
  executeSaveVariable,
  evaluateCondition,
  resolveTemplate,
  BotFlowExecutionContext,
} from "@/lib/botflow-control";

describe("Lead Field Bot Runtime", () => {
  const tenantId = randomUUID();

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM contact_custom_field_values WHERE user_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contact_custom_fields WHERE user_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contact_identities WHERE user_id = ?`, [tenantId]);
    await db.query(`DELETE FROM contacts WHERE user_id = ?`, [tenantId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
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

  function buildContext(contact: { id: string; phone_e164?: string | null }): BotFlowExecutionContext {
    return {
      tenantId,
      userId: tenantId,
      contact: {
        id: contact.id,
        phone: contact.phone_e164 || "",
        phone_e164: contact.phone_e164 || null,
        name: "",
        email: "",
        customFields: {},
      },
      message: {},
      channel: "whatsapp",
      variables: {},
    };
  }

  test("executeSaveVariable with field reference writes standard name", async () => {
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 91111-1111",
      name: "A",
    });
    const ctx = buildContext(contact);

    await executeSaveVariable(
      {
        scope: "contact",
        field: { kind: "standard", field: "name" },
        value: "Maria Silva",
      },
      ctx,
      db,
    );

    const rows = (await db.query("SELECT name FROM contacts WHERE id = ?", [contact.id])) as Array<{
      name: string;
    }>;
    expect(rows[0].name).toBe("Maria Silva");
    expect(ctx.variables["name"]).toBe("Maria Silva");
  });

  test("executeSaveVariable with field reference writes custom field by id", async () => {
    const key = `plano_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("select", "Plano", key, ["Basic", "Premium"]);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 92222-2222",
      name: "B",
    });
    const ctx = buildContext(contact);

    await executeSaveVariable(
      {
        scope: "contact",
        field: { kind: "custom", field: defId },
        value: "Premium",
      },
      ctx,
      db,
    );

    const values = (await db.query(
      `SELECT cfv.value FROM contact_custom_field_values cfv WHERE cfv.user_id = ? AND cfv.contact_id = ?`,
      [tenantId, contact.id],
    )) as Array<{ value: string }>;
    expect(values[0].value).toBe("Premium");
  });

  test("executeSaveVariable with invalid select option is rejected", async () => {
    const key = `plano2_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("select", "Plano", key, ["Basic", "Premium"]);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 93333-3333",
      name: "C",
    });
    const ctx = buildContext(contact);

    await expect(
      executeSaveVariable(
        {
          scope: "contact",
          field: { kind: "custom", field: defId },
          value: "Banana",
        },
        ctx,
        db,
      ),
    ).rejects.toThrow();
  });

  test("resolveTemplate reads standard and custom fields from context", () => {
    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: {
        id: "contact-1",
        phone: "5511999999999",
        phone_e164: "5511999999999",
        whatsapp_number: "5511999999999",
        name: "Maria",
        email: "maria@test.com",
        company: "Acme",
        position: "Gerente",
        notes: "Nota",
        customFields: { plano_interesse: "Premium" },
      },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    expect(resolveTemplate("Olá {{contact.name}}", ctx)).toBe("Olá Maria");
    expect(resolveTemplate("Empresa: {{contact.company}}", ctx)).toBe("Empresa: Acme");
    expect(resolveTemplate("Plano: {{contact.plano_interesse}}", ctx)).toBe("Plano: Premium");
    expect(resolveTemplate("Legado: {{contact.custom_fields.plano_interesse}}", ctx)).toBe("Legado: Premium");
  });

  test("evaluateCondition with field reference compares numbers", async () => {
    const key = `orcamento_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("number", "Orçamento", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 94444-4444",
      name: "D",
    });
    await db.query(
      "INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value) VALUES (?, ?, ?, ?)",
      [tenantId, contact.id, defId, "75000"],
    );

    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { id: contact.id, phone: "", customFields: { [key]: 75000 } },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    const isTrue = await evaluateCondition(
      {
        rules: [{ field: { kind: "custom", field: defId }, operator: "greater_than", value: "50000" }],
      },
      ctx,
    );
    expect(isTrue).toBe(true);

    const isFalse = await evaluateCondition(
      {
        rules: [{ field: { kind: "custom", field: defId }, operator: "less_than", value: "10000" }],
      },
      ctx,
    );
    expect(isFalse).toBe(false);
  });

  test("evaluateCondition invalid operator for type throws", async () => {
    const key = `orcamento2_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("number", "Orçamento", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 95555-5555",
      name: "E",
    });

    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { id: contact.id, phone: "", customFields: {} },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    await expect(
      evaluateCondition(
        {
          rules: [{ field: { kind: "custom", field: defId }, operator: "contains", value: "x" }],
        },
        ctx,
      ),
    ).rejects.toThrow("inválido");
  });

  test("evaluateCondition with field reference compares select", async () => {
    const key = `plano3_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("select", "Plano", key, ["Basic", "Premium", "Enterprise"]);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 96666-6666",
      name: "F",
    });
    await db.query(
      "INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value) VALUES (?, ?, ?, ?)",
      [tenantId, contact.id, defId, "Enterprise"],
    );

    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { id: contact.id, phone: "", customFields: { [key]: "Enterprise" } },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    const isTrue = await evaluateCondition(
      {
        rules: [{ field: { kind: "custom", field: defId }, operator: "equals", value: "Enterprise" }],
      },
      ctx,
    );
    expect(isTrue).toBe(true);
  });

  test("legacy string condition still works", async () => {
    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { id: "legacy", phone: "", customFields: {} },
      message: { text: "sim" },
      channel: "whatsapp",
      variables: {},
    };

    const isTrue = await evaluateCondition(
      {
        rules: [{ left: "{{message.text}}", operator: "equals", right: "sim" }],
      },
      ctx,
    );
    expect(isTrue).toBe(true);
  });
});
