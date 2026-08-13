import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";
import crypto from "crypto";
import { assertBelongsToTenant, assertUserBelongsToTenant } from "./tenant-authorization";

async function ensureBotFlowsTable(db: any) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bot_flows (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        triggers_count INT NOT NULL DEFAULT 1,
        actions_count INT NOT NULL DEFAULT 1,
        last_executed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.warn("[BotFlows] Aviso ao auto-criar tabela bot_flows:", err);
  }
}

async function ensureBotFlowsColumns(db: any) {
  try {
    const cols = (await db.query("SHOW COLUMNS FROM bot_flows")) as any[];
    const colNames = cols.map((c: any) => c.Field);
    if (!colNames.includes("user_id")) {
      await db.query("ALTER TABLE bot_flows ADD COLUMN user_id VARCHAR(36) NULL AFTER id");
      await db.query(
        "UPDATE bot_flows SET user_id = tenant_id WHERE user_id IS NULL OR user_id = ''",
      );
      await db.query("ALTER TABLE bot_flows MODIFY COLUMN user_id VARCHAR(36) NOT NULL");
    }

    // Bancos criados pelo schema legado possuem flow_data JSON NOT NULL, mas
    // o editor atual persiste os passos em bot_steps. Tornar a coluna opcional
    // mantém os dados antigos e permite criar fluxos no formato atual.
    const legacyFlowData = cols.find((c: any) => c.Field === "flow_data");
    if (legacyFlowData && legacyFlowData.Null === "NO") {
      await db.query("ALTER TABLE bot_flows MODIFY COLUMN flow_data JSON NULL");
    }
  } catch (err) {
    console.warn("[BotFlows] Aviso ao migrar colunas de bot_flows:", err);
  }
}

async function insertBotFlow(
  db: any,
  flow: {
    id: string;
    tenantId: string;
    name: string;
    channel: string;
    triggersCount: number;
    actionsCount: number;
  },
) {
  const cols = (await db.query("SHOW COLUMNS FROM bot_flows")) as any[];
  const hasLegacyFlowData = cols.some((c: any) => c.Field === "flow_data");

  if (hasLegacyFlowData) {
    await db.query(
      `INSERT INTO bot_flows
       (id, user_id, tenant_id, name, channel, is_active, triggers_count, actions_count, flow_data)
       VALUES (?, ?, ?, ?, ?, false, ?, ?, ?)`,
      [
        flow.id,
        flow.tenantId,
        flow.tenantId,
        flow.name,
        flow.channel,
        flow.triggersCount,
        flow.actionsCount,
        JSON.stringify({ nodes: [], edges: [] }),
      ],
    );
    return;
  }

  await db.query(
    `INSERT INTO bot_flows
     (id, user_id, tenant_id, name, channel, is_active, triggers_count, actions_count)
     VALUES (?, ?, ?, ?, ?, false, ?, ?)`,
    [
      flow.id,
      flow.tenantId,
      flow.tenantId,
      flow.name,
      flow.channel,
      flow.triggersCount,
      flow.actionsCount,
    ],
  );
}

async function ensureBotStepsColumns(db: any) {
  try {
    const cols: any[] = (await db.query(`SHOW COLUMNS FROM bot_steps`)) as any[];
    const colNames = cols.map((c: any) => c.Field);
    if (!colNames.includes("flow_id")) {
      await db.query(`ALTER TABLE bot_steps ADD COLUMN flow_id VARCHAR(36) NULL`);
    }
    if (!colNames.includes("tenant_id")) {
      await db.query(`ALTER TABLE bot_steps ADD COLUMN tenant_id VARCHAR(36) NULL AFTER id`);
      await db.query(`UPDATE bot_steps SET tenant_id = user_id WHERE tenant_id IS NULL OR tenant_id = ''`);
    }
  } catch (err) {
    console.warn("[BotSteps] Aviso ao migrar colunas de bot_steps:", err);
  }
}

async function ensureBotSettingsColumns(db: any) {
  try {
    const cols: any[] = (await db.query(`SHOW COLUMNS FROM bot_settings`)) as any[];
    const colNames = cols.map((c: any) => c.Field);
    if (!colNames.includes("tenant_id")) {
      await db.query(`ALTER TABLE bot_settings ADD COLUMN tenant_id VARCHAR(36) NULL AFTER id`);
      await db.query(`UPDATE bot_settings SET tenant_id = user_id WHERE tenant_id IS NULL OR tenant_id = ''`);
    }
  } catch (err) {
    console.warn("[BotSettings] Aviso ao migrar colunas de bot_settings:", err);
  }
}

/**
 * Obtém ou cria o registro bot_settings do usuário logado.
 */
async function getOrCreateBotSettings(context: any, channelInput?: string) {
  const channel = channelInput || "whatsapp";
  const { resolveEffectiveUserId } = await import("./chat-helpers");
  const { default: db } = await import("./db");
  const effectiveUserId = await resolveEffectiveUserId(context.userId);

  await ensureBotSettingsColumns(db);

  const profileRows = (await db.query(
    "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ?",
    [effectiveUserId],
  )) as any[];
  const p = profileRows?.[0] ?? null;

  const settingsList = (await db.query(
    "SELECT * FROM bot_settings WHERE user_id = ? AND channel = ?",
    [effectiveUserId, channel],
  )) as any[];
  let settings = settingsList?.[0] ?? null;

  if (!settings) {
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO bot_settings (id, tenant_id, user_id, instance_id, channel, is_active, pause_timeout_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        effectiveUserId,
        effectiveUserId,
        channel === "whatsapp" ? p?.whatsapp_phone_number_id || null : null,
        channel,
        false,
        60,
      ],
    );
    const rows = (await db.query("SELECT * FROM bot_settings WHERE id = ?", [id])) as any[];
    settings = rows?.[0] ?? null;
    if (!settings) {
      return { ok: false as const, error: "Erro ao criar configurações do bot" };
    }
  } else if (
    channel === "whatsapp" &&
    p?.whatsapp_phone_number_id &&
    settings.instance_id !== p.whatsapp_phone_number_id
  ) {
    await db.query("UPDATE bot_settings SET instance_id = ? WHERE id = ?", [
      p.whatsapp_phone_number_id,
      settings.id,
    ]);
    settings.instance_id = p.whatsapp_phone_number_id;
  }

  return { ok: true as const, settings, profile: p };
}

async function ensureMetaWebhookSubscription(userId: string) {
  const { default: db } = await import("./db");
  const rows = (await db.query(
    `SELECT whatsapp_waba_id, whatsapp_access_token, meta_graph_version
     FROM profiles WHERE id = ? LIMIT 1`,
    [userId],
  )) as any[];
  const profile = rows?.[0];
  if (!profile?.whatsapp_waba_id || !profile?.whatsapp_access_token) {
    return { ok: false as const, error: "WABA ID ou Access Token não configurado." };
  }

  const apiVersion = profile.meta_graph_version || "v26.0";
  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_waba_id}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${profile.whatsapp_access_token}` },
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || "A Meta recusou a inscrição do webhook.";
    console.error("[BotFlows] Falha ao inscrever aplicativo na WABA:", message);
    return { ok: false as const, error: message };
  }
  return { ok: true as const };
}

// ============================================================================
// LISTA DE FLUXOS DE AUTOMAÇÃO (bot_flows)
// ============================================================================

export const listBotFlows = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ channel: z.string().optional() }).optional().parse(d))
  .handler(async ({ data, context }: { data?: { channel?: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const tenantId = await resolveEffectiveUserId(context.userId);

      await ensureBotFlowsTable(db);
      await ensureBotFlowsColumns(db);

      const flows = (await db.query(
        "SELECT * FROM bot_flows WHERE tenant_id = ? ORDER BY created_at DESC",
        [tenantId],
      )) as any[];

      return {
        ok: true,
        flows: (flows || []).map((f: any) => ({
          ...f,
          is_active: Boolean(f.is_active),
        })),
      };
    } catch (err: any) {
      console.error("[BotFlows] Erro ao listar fluxos:", err);
      return { ok: false, flows: [], error: err?.message };
    }
  });

export const createBotFlow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ name: z.string().optional() }).parse(d))
  .handler(async ({ data, context }: { data: { name?: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const tenantId = await resolveEffectiveUserId(context.userId);

      await ensureBotFlowsTable(db);
      await ensureBotFlowsColumns(db);

      const flowId = crypto.randomUUID();
      const name = data.name || "Novo Fluxo";

      await insertBotFlow(db, {
        id: flowId,
        tenantId,
        name,
        channel: "whatsapp",
        triggersCount: 1,
        actionsCount: 1,
      });

      const [flow] = (await db.query("SELECT * FROM bot_flows WHERE id = ?", [flowId])) as any[];

      return { ok: true, flow };
    } catch (err: any) {
      console.error("[BotFlows] Erro ao criar fluxo:", err);
      throw new Error(err?.message || "Falha ao criar fluxo.");
    }
  });

export const toggleBotFlowStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string; isActive: boolean }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const tenantId = await resolveEffectiveUserId(context.userId);

      const flowRows = (await db.query(
        "SELECT channel FROM bot_flows WHERE id = ? AND tenant_id = ? LIMIT 1",
        [data.id, tenantId],
      )) as any[];
      const flow = flowRows?.[0];
      if (!flow) throw new Error("Fluxo não encontrado.");

      await db.query("UPDATE bot_flows SET is_active = ? WHERE id = ? AND tenant_id = ?", [
        data.isActive ? 1 : 0,
        data.id,
        tenantId,
      ]);

      // Um fluxo ativo com o motor global desligado nunca pode executar. Ao
      // ativar qualquer fluxo, habilitamos também o bot_settings do mesmo canal.
      // Desativar um fluxo não desliga os demais fluxos ativos.
      if (data.isActive) {
        const settingsResult = await getOrCreateBotSettings(context, flow.channel || "whatsapp");
        if (!settingsResult.ok) {
          throw new Error(settingsResult.error || "Falha ao ativar o motor do bot.");
        }
        await db.query("UPDATE bot_settings SET is_active = 1 WHERE id = ?", [
          settingsResult.settings.id,
        ]);
        const subscription = await ensureMetaWebhookSubscription(tenantId);
        if (!subscription.ok) {
          return {
            ok: true,
            warning: `Fluxo ativado, mas o webhook da Meta não foi inscrito: ${subscription.error}`,
          };
        }
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[BotFlows] Erro ao atualizar status do fluxo:", err);
      throw new Error(err?.message || "Falha ao atualizar status.");
    }
  });

export const duplicateBotFlow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const tenantId = await resolveEffectiveUserId(context.userId);

      await ensureBotFlowsTable(db);
      await ensureBotFlowsColumns(db);

      const [flow] = (await db.query("SELECT * FROM bot_flows WHERE id = ? AND tenant_id = ?", [
        data.id,
        tenantId,
      ])) as any[];

      if (!flow) throw new Error("Fluxo não encontrado.");

      const newId = crypto.randomUUID();
      const newName = `${flow.name} (Cópia)`;

      await insertBotFlow(db, {
        id: newId,
        tenantId,
        name: newName,
        channel: flow.channel,
        triggersCount: flow.triggers_count,
        actionsCount: flow.actions_count,
      });

      const steps = (await db.query("SELECT * FROM bot_steps WHERE flow_id = ?", [
        data.id,
      ])) as any[];
      for (const s of steps || []) {
        const stepId = crypto.randomUUID();
        await db.query(
          `INSERT INTO bot_steps (id, tenant_id, bot_settings_id, flow_id, user_id, step_order, trigger_type, trigger_value, message_type,
           message_content, media_url, media_caption, footer_text, buttons_config, delay_seconds, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stepId,
            tenantId,
            s.bot_settings_id,
            newId,
            tenantId,
            s.step_order,
            s.trigger_type,
            s.trigger_value,
            s.message_type,
            s.message_content,
            s.media_url,
            s.media_caption,
            s.footer_text,
            s.buttons_config,
            s.delay_seconds,
            s.position_x,
            s.position_y,
          ],
        );
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[BotFlows] Erro ao duplicar fluxo:", err);
      throw new Error(err?.message || "Falha ao duplicar fluxo.");
    }
  });

export const deleteBotFlow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const tenantId = await resolveEffectiveUserId(context.userId);

      await assertBelongsToTenant(data.id, "bot_flow", tenantId);
      await db.query("DELETE FROM bot_steps WHERE flow_id = ?", [data.id]);
      await db.query("DELETE FROM bot_flows WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
      return { ok: true };
    } catch (err: any) {
      console.error("[BotFlows] Erro ao deletar fluxo:", err);
      throw new Error(err?.message || "Falha ao deletar fluxo.");
    }
  });

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ channel: z.string().optional() }).optional().parse(d))
  .handler(async ({ data, context }: { data?: { channel?: string }; context: any }) => {
    const result = await getOrCreateBotSettings(context, data?.channel);
    if (!result.ok) return result;
    return { ok: true, settings: result.settings };
  });

export const toggleBotStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z.object({ isActive: z.boolean(), channel: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { default: db } = await import("./db");
    const result = await getOrCreateBotSettings(context, data.channel);
    if (!result.ok) return result;

    await db.query("UPDATE bot_settings SET is_active = ? WHERE id = ?", [
      data.isActive ? 1 : 0,
      result.settings.id,
    ]);

    return { ok: true };
  });

export const updateBotPauseTimeout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        minutes: z.number().int().min(1).max(7 * 24 * 60),
        channel: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }: { data: { minutes: number; channel?: string }; context: any }) => {
    const { default: db } = await import("./db");
    const result = await getOrCreateBotSettings(context, data.channel);
    if (!result.ok) return result;

    await db.query("UPDATE bot_settings SET pause_timeout_minutes = ? WHERE id = ?", [
      data.minutes,
      result.settings.id,
    ]);

    return { ok: true, pause_timeout_minutes: data.minutes };
  });

export const listBotSteps = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({ channel: z.string().optional(), flowId: z.string().optional().nullable() })
      .optional()
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }: {
      data?: { channel?: string; flowId?: string | null };
      context: any;
    }) => {
      const { default: db } = await import("./db");
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const result = await getOrCreateBotSettings(context, data?.channel);
      if (!result.ok) throw new Error(result.error || "Falha ao obter configurações do bot");

      await ensureBotStepsColumns(db);

      let steps: any[];
      if (data?.flowId) {
        await assertBelongsToTenant(data.flowId, "bot_flow", effectiveUserId);
        steps = (await db.query(
          "SELECT * FROM bot_steps WHERE flow_id = ? AND user_id = ? ORDER BY step_order ASC",
          [data.flowId, effectiveUserId],
        )) as any[];
      } else {
        steps = (await db.query(
          "SELECT * FROM bot_steps WHERE bot_settings_id = ? ORDER BY step_order ASC",
          [result.settings.id],
        )) as any[];
      }

      return steps ?? [];
    },
  );

const saveBotStepInput = z.object({
  id: z.string().optional(),
  step_order: z.number(),
  trigger_type: z.string().min(1),
  trigger_value: z.string().nullable().optional(),
  condition_operator: z.string().nullable().optional(),
  message_type: z.string().optional(),
  message_content: z.string().optional(),
  media_url: z.string().optional().nullable(),
  media_caption: z.string().optional().nullable(),
  buttons_config: z.any().optional().nullable(),
  next_step_id: z.string().optional().nullable(),
  position_x: z.number().optional().default(0),
  position_y: z.number().optional().default(0),
  footer_text: z.string().optional().nullable(),
  delay_seconds: z.number().optional().nullable(),
  assign_team_id: z.string().optional().nullable(),
  assign_user_id: z.string().optional().nullable(),
  handoff_message: z.string().optional().nullable(),
  card_color: z.string().optional().nullable(),
});

const saveBotStepsBatchInput = z.object({
  channel: z.string().optional(),
  flowId: z.string().optional().nullable(),
  steps: z.array(saveBotStepInput),
});

export const saveBotStepsBatch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepsBatchInput.parse(d))
  .handler(
    async ({
      data,
      context,
    }: {
      data: { channel?: string; flowId?: string | null; steps: any[] };
      context: any;
    }) => {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      const result = await getOrCreateBotSettings(context, data.channel);
      if (!result.ok)
        return { ok: false as const, error: result.error || "Falha ao obter configurações do bot" };

      const settings = result.settings;
      await ensureBotStepsColumns(db);

      const flowId = data.flowId || null;
      const incomingIds = data.steps.map((s) => s.id).filter(Boolean);

      if (flowId) {
        await assertBelongsToTenant(flowId, "bot_flow", effectiveUserId);
        if (incomingIds.length > 0) {
          const placeholders = incomingIds.map(() => "?").join(",");
          await db.query(
            `DELETE FROM bot_steps WHERE flow_id = ? AND user_id = ? AND id NOT IN (${placeholders})`,
            [flowId, effectiveUserId, ...incomingIds],
          );
        } else {
          await db.query("DELETE FROM bot_steps WHERE flow_id = ? AND user_id = ?", [
            flowId,
            effectiveUserId,
          ]);
        }
      } else {
        if (incomingIds.length > 0) {
          const placeholders = incomingIds.map(() => "?").join(",");
          await db.query(
            `DELETE FROM bot_steps WHERE bot_settings_id = ? AND id NOT IN (${placeholders})`,
            [settings.id, ...incomingIds],
          );
        } else {
          await db.query("DELETE FROM bot_steps WHERE bot_settings_id = ?", [settings.id]);
        }
      }

      let triggersCount = 0;
      let actionsCount = 0;

      for (const step of data.steps) {
        if (step.assign_team_id)
          await assertBelongsToTenant(step.assign_team_id, "team", effectiveUserId);
        if (step.assign_user_id)
          await assertUserBelongsToTenant(step.assign_user_id, effectiveUserId);
        if (step.next_step_id && !incomingIds.includes(step.next_step_id))
          await assertBelongsToTenant(step.next_step_id, "bot_step", effectiveUserId);
        const stepId = step.id || crypto.randomUUID();
        const isTrigger = [
          "start",
          "keyword",
          "webhook",
          "button",
          "inactivity",
          "first_message",
          "tag_assigned",
          "queue_assigned",
          "instagram_event",
          "shopify_event",
        ].includes(step.trigger_type);
        if (isTrigger) triggersCount++;
        else actionsCount++;

        const payload = {
          bot_settings_id: settings.id,
          flow_id: flowId,
          user_id: effectiveUserId,
          step_order: step.step_order,
          trigger_type: step.trigger_type,
          trigger_value: step.trigger_value || null,
          message_type: step.message_type || "text",
          message_content: step.message_content || null,
          media_url: step.media_url || null,
          media_caption: step.media_caption || null,
          footer_text: step.footer_text || null,
          buttons_config: step.buttons_config ? JSON.stringify(step.buttons_config) : null,
          next_step_id: null,
          delay_seconds: Number(step.delay_seconds || 0),
          position_x: step.position_x || 0,
          position_y: step.position_y || 0,
          assign_team_id: step.assign_team_id || null,
          assign_user_id: step.assign_user_id || null,
          handoff_message: step.handoff_message || null,
          card_color: step.card_color || null,
        };

        const existing = (await db.query("SELECT id FROM bot_steps WHERE id = ? AND user_id = ?", [
          stepId,
          effectiveUserId,
        ])) as any[];

        if (existing?.length > 0) {
          await db.query(
            `UPDATE bot_steps SET bot_settings_id = ?, flow_id = ?, user_id = ?, step_order = ?, trigger_type = ?, trigger_value = ?,
           message_type = ?, message_content = ?, media_url = ?, media_caption = ?, footer_text = ?,
           buttons_config = ?, next_step_id = ?, delay_seconds = ?, position_x = ?, position_y = ?,
           assign_team_id = ?, assign_user_id = ?, handoff_message = ?, card_color = ?
           WHERE id = ? AND user_id = ?`,
            [
              payload.bot_settings_id,
              payload.flow_id,
              payload.user_id,
              payload.step_order,
              payload.trigger_type,
              payload.trigger_value,
              payload.message_type,
              payload.message_content,
              payload.media_url,
              payload.media_caption,
              payload.footer_text,
              payload.buttons_config,
              payload.next_step_id,
              payload.delay_seconds,
              payload.position_x,
              payload.position_y,
              payload.assign_team_id,
              payload.assign_user_id,
              payload.handoff_message,
              payload.card_color,
              stepId,
              effectiveUserId,
            ],
          );
        } else {
          await db.query(
            `INSERT INTO bot_steps (id, tenant_id, bot_settings_id, flow_id, user_id, step_order, trigger_type, trigger_value, message_type,
           message_content, media_url, media_caption, footer_text, buttons_config, next_step_id, delay_seconds,
           position_x, position_y, assign_team_id, assign_user_id, handoff_message, card_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              stepId,
              effectiveUserId,
              payload.bot_settings_id,
              payload.flow_id,
              payload.user_id,
              payload.step_order,
              payload.trigger_type,
              payload.trigger_value,
              payload.message_type,
              payload.message_content,
              payload.media_url,
              payload.media_caption,
              payload.footer_text,
              payload.buttons_config,
              payload.next_step_id,
              payload.delay_seconds,
              payload.position_x,
              payload.position_y,
              payload.assign_team_id,
              payload.assign_user_id,
              payload.handoff_message,
              payload.card_color,
            ],
          );
        }
      }

      for (const step of data.steps) {
        if (!step.next_step_id) continue;
        await db.query("UPDATE bot_steps SET next_step_id = ? WHERE id = ? AND user_id = ?", [
          step.next_step_id,
          step.id,
          effectiveUserId,
        ]);
      }

      if (flowId) {
        await db.query(
          "UPDATE bot_flows SET triggers_count = ?, actions_count = ? WHERE id = ? AND tenant_id = ?",
          [Math.max(1, triggersCount), Math.max(1, actionsCount), flowId, effectiveUserId],
        );
      }

      const subscription = await ensureMetaWebhookSubscription(effectiveUserId);

      return {
        ok: true,
        ...(!subscription.ok
          ? { warning: `Fluxo salvo, mas o webhook da Meta não foi inscrito: ${subscription.error}` }
          : {}),
      };
    },
  );

export const saveBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    await ensureBotStepsColumns(db);

    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;

    if (data.assign_team_id)
      await assertBelongsToTenant(data.assign_team_id, "team", effectiveUserId);
    if (data.assign_user_id) await assertUserBelongsToTenant(data.assign_user_id, effectiveUserId);
    if (data.next_step_id)
      await assertBelongsToTenant(data.next_step_id, "bot_step", effectiveUserId);

    const payload = {
      tenant_id: effectiveUserId,
      bot_settings_id: result.settings.id,
      user_id: effectiveUserId,
      step_order: data.step_order,
      trigger_type: data.trigger_type,
      trigger_value: data.trigger_value || null,
      message_type: data.message_type || "text",
      message_content: data.message_content || null,
      media_url: data.media_url || null,
      media_caption: data.media_caption || null,
      footer_text: data.footer_text || null,
      buttons_config: data.buttons_config ? JSON.stringify(data.buttons_config) : null,
      next_step_id: data.next_step_id || null,
      delay_seconds: Number(data.delay_seconds || 0),
      position_x: data.position_x || 0,
      position_y: data.position_y || 0,
      assign_team_id: data.assign_team_id || null,
      assign_user_id: data.assign_user_id || null,
      handoff_message: data.handoff_message || null,
      card_color: data.card_color || null,
    };

    const stepId = data.id || crypto.randomUUID();
    const existing = (await db.query("SELECT id FROM bot_steps WHERE id = ? AND user_id = ?", [
      stepId,
      effectiveUserId,
    ])) as any[];
    const cols = Object.keys(payload);
    const vals = Object.values(payload);

    if (existing?.length > 0) {
      const setClause = cols.map((c) => `${c} = ?`).join(", ");
      await db.query(`UPDATE bot_steps SET ${setClause} WHERE id = ? AND user_id = ?`, [
        ...vals,
        stepId,
        effectiveUserId,
      ]);
    } else {
      const placeholders = cols.map(() => "?").join(", ");
      await db.query(`INSERT INTO bot_steps (id, ${cols.join(", ")}) VALUES (?, ${placeholders})`, [
        stepId,
        ...vals,
      ]);
    }

    const rows = (await db.query("SELECT * FROM bot_steps WHERE id = ? AND user_id = ?", [
      stepId,
      effectiveUserId,
    ])) as any[];
    return { ok: true, step: rows?.[0] ?? null };
  });

export const deleteBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await assertBelongsToTenant(data.id, "bot_step", effectiveUserId);
    await db.query("DELETE FROM bot_steps WHERE id = ? AND user_id = ?", [
      data.id,
      effectiveUserId,
    ]);
    return { ok: true };
  });

export const listWhatsAppFlows = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const data = (await db.query("SELECT * FROM whatsapp_flows WHERE user_id = ?", [
      effectiveUserId,
    ])) as any[];
    return { ok: true as const, flows: data ?? [] };
  });
