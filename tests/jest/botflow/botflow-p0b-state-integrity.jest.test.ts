import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import {
  duplicateBotFlowCore,
  remapFlowStepReferences,
} from "@/lib/botflow.functions";

describe("P0-B State / Data Integrity", () => {
  const tenantId = randomUUID();
  let settingsId: string;

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);

    settingsId = randomUUID();
    await db.query(
      `INSERT INTO bot_settings (id, tenant_id, user_id, instance_id, channel, is_active, pause_timeout_minutes)
       VALUES (?, ?, ?, NULL, 'whatsapp', false, 60)`,
      [settingsId, tenantId, tenantId],
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM bot_conversation_state WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM bot_steps WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM bot_flows WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM bot_settings WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  async function createFlowWithSteps(stepCount: number, configBuilder?: (ids: string[]) => any) {
    const flowId = randomUUID();
    await db.query(
      `INSERT INTO bot_flows (id, user_id, tenant_id, name, channel, is_active, triggers_count, actions_count)
       VALUES (?, ?, ?, ?, 'whatsapp', false, 1, ?)`,
      [flowId, tenantId, tenantId, `flow-${flowId}`, stepCount],
    );

    const stepIds = Array.from({ length: stepCount }, () => randomUUID());
    for (let i = 0; i < stepCount; i++) {
      const nextId = i < stepCount - 1 ? stepIds[i + 1] : null;
      const cfg = configBuilder ? configBuilder(stepIds) : {};
      await db.query(
        `INSERT INTO bot_steps (
          id, tenant_id, bot_settings_id, flow_id, user_id, step_order,
          trigger_type, trigger_value, message_type, message_content,
          media_url, media_caption, footer_text, buttons_config, next_step_id,
          delay_seconds, assign_team_id, assign_user_id, handoff_message, card_color,
          position_x, position_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stepIds[i],
          tenantId,
          settingsId,
          flowId,
          tenantId,
          i + 1,
          i === 0 ? "first_message" : "keyword",
          i === 0 ? null : `keyword-${i}`,
          "text",
          `Step ${i + 1}`,
          null,
          null,
          null,
          JSON.stringify({ ...(cfg ?? {}), stepIndex: i }),
          nextId,
          0,
          null,
          null,
          null,
          null,
          i * 100,
          i * 100,
        ],
      );
    }
    return { flowId, stepIds };
  }

  function parseConfig(value: any): any {
    if (value == null) return {};
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value;
  }

  describe("remapFlowStepReferences", () => {
    test("remaps step UUIDs and step:<id> strings", () => {
      const a = randomUUID();
      const b = randomUUID();
      const idMap = new Map([[a, b]]);
      const out = remapFlowStepReferences(
        { nextStepId: a, reply: { id: `step:${a}:tail` }, other: a },
        idMap,
      );
      expect(out.nextStepId).toBe(b);
      expect(out.reply.id).toBe(`step:${b}:tail`);
      // Plain UUIDs that are not inside known step fields should be preserved.
      expect(out.other).toBe(a);
    });

    test("preserves sentinel values", () => {
      const a = randomUUID();
      const b = randomUUID();
      const idMap = new Map([[a, b]]);
      const out = remapFlowStepReferences(
        { end: "-999", none: "none", empty: "", zero: "0", nextStepId: a },
        idMap,
      );
      expect(out.end).toBe("-999");
      expect(out.none).toBe("none");
      expect(out.empty).toBe("");
      expect(out.zero).toBe("0");
      expect(out.nextStepId).toBe(b);
    });
  });

  describe("duplicateBotFlow", () => {
    test("creates new flow and step ids", async () => {
      const { flowId, stepIds } = await createFlowWithSteps(3);
      const newFlowId = await duplicateBotFlowCore(db, tenantId, flowId);

      expect(newFlowId).not.toBe(flowId);

      const newSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order",
        [newFlowId, tenantId],
      )) as any[];

      expect(newSteps.length).toBe(3);
      for (const s of newSteps) {
        expect(s.id).not.toBe(stepIds[0]);
        expect(s.id).not.toBe(stepIds[1]);
        expect(s.id).not.toBe(stepIds[2]);
      }
    });

    test("remaps next_step_id to new step ids", async () => {
      const { flowId, stepIds } = await createFlowWithSteps(3);
      const newFlowId = await duplicateBotFlowCore(db, tenantId, flowId);

      const newSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order",
        [newFlowId, tenantId],
      )) as any[];

      const orderToNewId = new Map(newSteps.map((s) => [s.step_order, s.id]));
      const first = newSteps.find((s) => s.step_order === 1);
      const second = newSteps.find((s) => s.step_order === 2);

      expect(first.next_step_id).toBe(second?.id);
      expect(orderToNewId.has(3)).toBe(true);
      const third = newSteps.find((s) => s.step_order === 3);
      expect(third.next_step_id).toBeNull();

      const originalSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order",
        [flowId, tenantId],
      )) as any[];
      expect(originalSteps[0].next_step_id).toBe(stepIds[1]);
    });

    test("remaps nested step references inside buttons_config", async () => {
      const { flowId, stepIds } = await createFlowWithSteps(2, (ids) => ({
        control: {
          nextStepId: ids[1],
          trueStepId: ids[1],
          falseStepId: "-999",
          successStepId: ids[1],
          errorStepId: ids[1],
        },
        next_step_on_success: ids[1],
        branches: [{ nextStepId: ids[1] }],
        options: [{ id: `step:${ids[1]}`, label: "Option A" }],
        payload: {
          list: { rows: [{ id: `step:${ids[1]}:row1`, title: "A" }] },
        },
      }));

      const originalStep = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order LIMIT 1",
        [flowId, tenantId],
      )) as any[];

      const newFlowId = await duplicateBotFlowCore(db, tenantId, flowId);

      const newSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order",
        [newFlowId, tenantId],
      )) as any[];

      const second = newSteps.find((s) => s.step_order === 2);
      const firstNew = newSteps.find((s) => s.step_order === 1);
      const cfg = parseConfig(firstNew.buttons_config);

      expect(cfg.control.nextStepId).toBe(second?.id);
      expect(cfg.control.trueStepId).toBe(second?.id);
      expect(cfg.control.falseStepId).toBe("-999");
      expect(cfg.next_step_on_success).toBe(second?.id);
      expect(cfg.branches[0].nextStepId).toBe(second?.id);
      expect(cfg.options[0].id).toBe(`step:${second?.id}`);
      expect(cfg.payload.list.rows[0].id).toBe(`step:${second?.id}:row1`);

      // Original remains untouched.
      const originalFirst = (await db.query(
        "SELECT * FROM bot_steps WHERE id = ? AND tenant_id = ?",
        [originalStep[0].id, tenantId],
      )) as any[];
      const originalCfg = parseConfig(originalFirst[0].buttons_config);
      expect(originalCfg.control.nextStepId).toBe(stepIds[1]);
    });

    test("clone and original are independent on mutation", async () => {
      const { flowId, stepIds } = await createFlowWithSteps(2, (ids) => ({
        nextStepId: ids[1],
      }));
      const newFlowId = await duplicateBotFlowCore(db, tenantId, flowId);

      const newSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND tenant_id = ? ORDER BY step_order",
        [newFlowId, tenantId],
      )) as any[];

      // Mutate clone buttons_config.
      const fakeId = randomUUID();
      const cloneFirst = newSteps[0];
      await db.query(
        "UPDATE bot_steps SET buttons_config = ? WHERE id = ? AND tenant_id = ?",
        [JSON.stringify({ nextStepId: fakeId }), cloneFirst.id, tenantId],
      );

      const original = (await db.query(
        "SELECT * FROM bot_steps WHERE id = ? AND tenant_id = ?",
        [stepIds[0], tenantId],
      )) as any[];

      const originalCfg = parseConfig(original[0].buttons_config);
      expect(originalCfg.nextStepId).toBe(stepIds[1]);
    });
  });

  describe("bot_conversation_state cross-channel isolation", () => {
    test("allows one state row per channel for the same user/contact/instance", async () => {
      const contactNumber = `555000${Math.floor(Math.random() * 100000)}`;
      const instanceId = `instance-${randomUUID()}`;

      await db.query(
        `INSERT INTO bot_conversation_state (id, user_id, tenant_id, contact_number, instance_id, channel, current_step_id)
         VALUES (?, ?, ?, ?, ?, 'whatsapp', NULL)`,
        [randomUUID(), tenantId, tenantId, contactNumber, instanceId],
      );

      await db.query(
        `INSERT INTO bot_conversation_state (id, user_id, tenant_id, contact_number, instance_id, channel, current_step_id)
         VALUES (?, ?, ?, ?, ?, 'instagram', NULL)`,
        [randomUUID(), tenantId, tenantId, contactNumber, instanceId],
      );

      const rows = (await db.query(
        `SELECT channel FROM bot_conversation_state WHERE tenant_id = ? AND contact_number = ? AND instance_id = ?`,
        [tenantId, contactNumber, instanceId],
      )) as any[];

      expect(rows.map((r) => r.channel).sort()).toEqual(["instagram", "whatsapp"]);

      // Cleanup
      await db.query(
        `DELETE FROM bot_conversation_state WHERE tenant_id = ? AND contact_number = ? AND instance_id = ?`,
        [tenantId, contactNumber, instanceId],
      );
    });

    test("enforces uniqueness on (user_id, contact_number, instance_id, channel)", async () => {
      const contactNumber = `555000${Math.floor(Math.random() * 100000)}`;
      const instanceId = `instance-${randomUUID()}`;

      await db.query(
        `INSERT INTO bot_conversation_state (id, user_id, tenant_id, contact_number, instance_id, channel, current_step_id)
         VALUES (?, ?, ?, ?, ?, 'whatsapp', NULL)`,
        [randomUUID(), tenantId, tenantId, contactNumber, instanceId],
      );

      await expect(
        db.query(
          `INSERT INTO bot_conversation_state (id, user_id, tenant_id, contact_number, instance_id, channel, current_step_id)
           VALUES (?, ?, ?, ?, ?, 'whatsapp', NULL)`,
          [randomUUID(), tenantId, tenantId, contactNumber, instanceId],
        ),
      ).rejects.toThrow(/Duplicate entry/);

      await db.query(
        `DELETE FROM bot_conversation_state WHERE tenant_id = ? AND contact_number = ? AND instance_id = ?`,
        [tenantId, contactNumber, instanceId],
      );
    });
  });
});
