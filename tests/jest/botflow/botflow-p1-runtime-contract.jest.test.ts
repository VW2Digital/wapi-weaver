import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createContactForUser } from "@/lib/services/contacts.service";
import { evaluateCondition, BotFlowExecutionContext } from "@/lib/botflow-control";
import { buildWhatsAppBotMessage } from "@/lib/meta-whatsapp-message";

describe("BotFlow P1 Runtime Contract", () => {
  const tenantId = randomUUID();
  const botSettingsId = randomUUID();
  const flowId = randomUUID();

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
    await db.query(
      `INSERT INTO bot_settings (id, tenant_id, user_id, instance_id, is_active, channel) VALUES (?, ?, ?, ?, ?, ?)`,
      [botSettingsId, tenantId, tenantId, `instance-${randomUUID().slice(0, 8)}`, 1, "whatsapp"],
    );
    await db.query(
      `INSERT INTO bot_flows (id, user_id, tenant_id, name, channel, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [flowId, tenantId, tenantId, "P1 Contract Test Flow", "whatsapp", 1],
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM bot_steps WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM bot_flows WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM bot_settings WHERE tenant_id = ?`, [tenantId]);
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

  test("condition_operator is not a database column", async () => {
    const columns = (await db.query(`SHOW COLUMNS FROM bot_steps`)) as Array<{ Field: string }>;
    const fieldNames = columns.map((c) => c.Field);
    expect(fieldNames).not.toContain("condition_operator");
  });

  test("condition config survives save/load roundtrip", async () => {
    const trueStepId = randomUUID();
    const falseStepId = randomUUID();
    const conditionStepId = randomUUID();

    const conditionConfig = {
      control: {
        logic: "OR",
        rules: [
          { left: "{{contact.name}}", operator: "equals", right: "Maria" },
          { field: { kind: "standard", field: "name" }, operator: "greater_than", value: "50000" },
        ],
        trueStepId,
        falseStepId,
      },
    };

    await db.query(
      `INSERT INTO bot_steps (id, tenant_id, user_id, bot_settings_id, flow_id, step_order, trigger_type, trigger_value, message_type, message_content, buttons_config, next_step_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conditionStepId,
        tenantId,
        tenantId,
        botSettingsId,
        flowId,
        1,
        "keyword",
        "cond",
        "condition",
        "Condition node",
        JSON.stringify(conditionConfig),
        null,
      ],
    );

    const rows = (await db.query(
      `SELECT buttons_config, next_step_id FROM bot_steps WHERE id = ? AND tenant_id = ?`,
      [conditionStepId, tenantId],
    )) as Array<{ buttons_config: any; next_step_id: string | null }>;

    expect(rows.length).toBe(1);
    const loaded =
      typeof rows[0].buttons_config === "string"
        ? JSON.parse(rows[0].buttons_config)
        : rows[0].buttons_config;

    expect(loaded.control.logic).toBe("OR");
    expect(loaded.control.rules).toHaveLength(2);
    expect(loaded.control.trueStepId).toBe(trueStepId);
    expect(loaded.control.falseStepId).toBe(falseStepId);
    expect(rows[0].next_step_id).toBeNull();
  });

  test("next_step_id and LeadFieldReference survive save/load roundtrip", async () => {
    const nextStepId = randomUUID();
    const saveVarStepId = randomUUID();

    const saveConfig = {
      control: {
        scope: "contact",
        field: { kind: "standard", field: "name" },
        value: "Maria",
        nextStepId,
      },
    };

    await db.query(
      `INSERT INTO bot_steps (id, tenant_id, user_id, bot_settings_id, flow_id, step_order, trigger_type, trigger_value, message_type, message_content, buttons_config, next_step_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saveVarStepId,
        tenantId,
        tenantId,
        botSettingsId,
        flowId,
        2,
        "keyword",
        "save",
        "save_variable",
        "Save node",
        JSON.stringify(saveConfig),
        nextStepId,
      ],
    );

    const rows = (await db.query(
      `SELECT buttons_config, next_step_id FROM bot_steps WHERE id = ? AND tenant_id = ?`,
      [saveVarStepId, tenantId],
    )) as Array<{ buttons_config: any; next_step_id: string | null }>;

    const loaded =
      typeof rows[0].buttons_config === "string"
        ? JSON.parse(rows[0].buttons_config)
        : rows[0].buttons_config;

    expect(loaded.control.field).toEqual({ kind: "standard", field: "name" });
    expect(loaded.control.nextStepId).toBe(nextStepId);
    expect(rows[0].next_step_id).toBe(nextStepId);
  });

  test("evaluateCondition legacy handles greater_than with Brazilian number format", async () => {
    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { phone: "" },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    const shouldBeTrue = await evaluateCondition(
      { rules: [{ left: "75.000,00", operator: "greater_than", right: "50.000,00" }] },
      ctx,
    );
    expect(shouldBeTrue).toBe(true);

    const shouldBeFalse = await evaluateCondition(
      { rules: [{ left: "10.000,00", operator: "greater_than", right: "50.000,00" }] },
      ctx,
    );
    expect(shouldBeFalse).toBe(false);
  });

  test("evaluateCondition legacy handles is_true, is_false, before, after", async () => {
    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { phone: "" },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    expect(
      await evaluateCondition({ rules: [{ left: "true", operator: "is_true" }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: "1", operator: "is_true" }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: "false", operator: "is_true" }] }, ctx),
    ).toBe(false);

    expect(
      await evaluateCondition({ rules: [{ left: "false", operator: "is_false" }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: "0", operator: "is_false" }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: "não", operator: "is_false" }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: "true", operator: "is_false" }] }, ctx),
    ).toBe(false);

    const d1 = "2024-01-15T00:00:00.000Z";
    const d2 = "2024-01-20T00:00:00.000Z";
    expect(
      await evaluateCondition({ rules: [{ left: d1, operator: "before", right: d2 }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: d2, operator: "before", right: d1 }] }, ctx),
    ).toBe(false);
    expect(
      await evaluateCondition({ rules: [{ left: d2, operator: "after", right: d1 }] }, ctx),
    ).toBe(true);
    expect(
      await evaluateCondition({ rules: [{ left: d1, operator: "after", right: d2 }] }, ctx),
    ).toBe(false);
  });

  test("evaluateCondition with LeadFieldReference executes greater_than correctly", async () => {
    const key = `orcamento_p1_${randomUUID().slice(0, 8)}`;
    const defId = await createDefinition("number", "Orçamento", key);
    const contact = await createContactForUser(tenantId, {
      phone: "+55 11 96666-6666",
      name: "Lead P1",
    });
    await db.query(
      `INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value) VALUES (?, ?, ?, ?)`,
      [tenantId, contact.id, defId, "75000"],
    );

    const ctx: BotFlowExecutionContext = {
      tenantId,
      userId: tenantId,
      contact: { id: contact.id, phone: "" },
      message: {},
      channel: "whatsapp",
      variables: {},
    };

    const isTrue = await evaluateCondition(
      { rules: [{ field: { kind: "custom", field: defId }, operator: "greater_than", value: "50000" }] },
      ctx,
    );
    expect(isTrue).toBe(true);

    const isFalse = await evaluateCondition(
      { rules: [{ field: { kind: "custom", field: defId }, operator: "greater_than", value: "100000" }] },
      ctx,
    );
    expect(isFalse).toBe(false);
  });

  test("buildWhatsAppBotMessage fails closed for product and whatsapp_flow", () => {
    const baseStep = {
      id: randomUUID(),
      message_type: "product",
      message_content: "Product message",
      buttons_config: {},
    };

    const product = buildWhatsAppBotMessage("5511999999999", baseStep as any);
    expect(product.ok).toBe(false);
    if (!product.ok) expect(product.code).toBe("BOTFLOW_INVALID_WHATSAPP_ACTION");

    const flow = buildWhatsAppBotMessage("5511999999999", { ...baseStep, message_type: "whatsapp_flow" } as any);
    expect(flow.ok).toBe(false);
    if (!flow.ok) expect(flow.code).toBe("BOTFLOW_INVALID_WHATSAPP_ACTION");

    const location = buildWhatsAppBotMessage("5511999999999", { ...baseStep, message_type: "location" } as any);
    expect(location.ok).toBe(false);
    if (!location.ok) expect(location.code).toBe("BOTFLOW_INVALID_WHATSAPP_ACTION");
  });
});
