import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";
import crypto from "crypto";

/**
 * Obtém ou cria o registro bot_settings do usuário logado.
 * instance_id é NULL quando o usuário ainda não configurou o WhatsApp —
 * isso é intencional e suportado pelo schema (NULL, não NOT NULL).
 */
async function getOrCreateBotSettings(context: any, channelInput?: string) {
  const channel = channelInput || "whatsapp";
  const { resolveEffectiveUserId } = await import("./chat-helpers");
  const { default: db } = await import("./db");
  const effectiveUserId = await resolveEffectiveUserId(context.userId);

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
      "INSERT INTO bot_settings (id, user_id, instance_id, channel, is_active, pause_timeout_minutes) VALUES (?, ?, ?, ?, ?, ?)",
      [id, effectiveUserId, channel === "whatsapp" ? p?.whatsapp_phone_number_id || null : null, channel, false, 60],
    );
    const rows = (await db.query("SELECT * FROM bot_settings WHERE id = ?", [id])) as any[];
    settings = rows?.[0] ?? null;
    if (!settings) {
      return { ok: false as const, error: "Erro ao criar configurações do bot" };
    }
  } else if (channel === "whatsapp" && p?.whatsapp_phone_number_id && settings.instance_id !== p.whatsapp_phone_number_id) {
    await db.query("UPDATE bot_settings SET instance_id = ? WHERE id = ?", [
      p.whatsapp_phone_number_id,
      settings.id,
    ]);
    settings.instance_id = p.whatsapp_phone_number_id;
  }

  return { ok: true as const, settings, profile: p };
}

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
  .validator((d: any) => z.object({ isActive: z.boolean(), channel: z.string().optional() }).parse(d))
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

export const listBotSteps = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ channel: z.string().optional() }).optional().parse(d))
  .handler(async ({ data, context }: { data?: { channel?: string }; context: any }) => {
    const { default: db } = await import("./db");
    const result = await getOrCreateBotSettings(context, data?.channel);
    if (!result.ok) throw new Error(result.error || "Falha ao obter configurações do bot");

    const steps = (await db.query(
      "SELECT * FROM bot_steps WHERE bot_settings_id = ? ORDER BY step_order ASC",
      [result.settings.id],
    )) as any[];
    return steps ?? [];
  });

// Validator para um único step
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
  steps: z.array(saveBotStepInput)
});

export const saveBotStepsBatch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepsBatchInput.parse(d))
  .handler(async ({ data, context }: { data: { channel?: string; steps: any[] }; context: any }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const result = await getOrCreateBotSettings(context, data.channel);
    if (!result.ok)
      return { ok: false as const, error: result.error || "Falha ao obter configurações do bot" };

    const settings = result.settings;
    const incomingIds = data.steps.map((s) => s.id).filter(Boolean);

    // Remove steps que não estão mais no fluxo
    if (incomingIds.length > 0) {
      const placeholders = incomingIds.map(() => "?").join(",");
      await db.query(
        `DELETE FROM bot_steps WHERE bot_settings_id = ? AND id NOT IN (${placeholders})`,
        [settings.id, ...incomingIds],
      );
    } else {
      await db.query("DELETE FROM bot_steps WHERE bot_settings_id = ?", [settings.id]);
    }

    // 1ª passagem: upsert de todos os steps SEM next_step_id (evita FK circular)
    for (const step of data.steps) {
      const stepId = step.id || crypto.randomUUID();
      const payload = {
        bot_settings_id: settings.id,
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

      // Verifica se o step já existe no banco
      const existing = (await db.query(
        "SELECT id FROM bot_steps WHERE id = ?",
        [stepId],
      )) as any[];

      if (existing?.length > 0) {
        await db.query(
          `UPDATE bot_steps SET bot_settings_id = ?, user_id = ?, step_order = ?, trigger_type = ?, trigger_value = ?,
           message_type = ?, message_content = ?, media_url = ?, media_caption = ?, footer_text = ?,
           buttons_config = ?, next_step_id = ?, delay_seconds = ?, position_x = ?, position_y = ?,
           assign_team_id = ?, assign_user_id = ?, handoff_message = ?, card_color = ?
           WHERE id = ?`,
          [
            payload.bot_settings_id, payload.user_id, payload.step_order, payload.trigger_type,
            payload.trigger_value, payload.message_type, payload.message_content, payload.media_url,
            payload.media_caption, payload.footer_text, payload.buttons_config, payload.next_step_id,
            payload.delay_seconds, payload.position_x, payload.position_y, payload.assign_team_id,
            payload.assign_user_id, payload.handoff_message, payload.card_color, stepId,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO bot_steps (id, bot_settings_id, user_id, step_order, trigger_type, trigger_value,
           message_type, message_content, media_url, media_caption, footer_text, buttons_config,
           next_step_id, delay_seconds, position_x, position_y, assign_team_id, assign_user_id,
           handoff_message, card_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stepId, payload.bot_settings_id, payload.user_id, payload.step_order, payload.trigger_type,
            payload.trigger_value, payload.message_type, payload.message_content, payload.media_url,
            payload.media_caption, payload.footer_text, payload.buttons_config, payload.next_step_id,
            payload.delay_seconds, payload.position_x, payload.position_y, payload.assign_team_id,
            payload.assign_user_id, payload.handoff_message, payload.card_color,
          ],
        );
        step.id = stepId;
      }
    }

    // 2ª passagem: resolve links next_step_id agora que todos existem
    for (const step of data.steps) {
      if (!step.next_step_id) continue;
      await db.query("UPDATE bot_steps SET next_step_id = ? WHERE id = ?", [
        step.next_step_id,
        step.id,
      ]);
    }

    return { ok: true };
  });

export const saveBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;

    const payload = {
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
    const existing = (await db.query("SELECT id FROM bot_steps WHERE id = ?", [stepId])) as any[];
    const cols = Object.keys(payload);
    const vals = Object.values(payload);

    if (existing?.length > 0) {
      const setClause = cols.map((c) => `${c} = ?`).join(", ");
      await db.query(`UPDATE bot_steps SET ${setClause} WHERE id = ?`, [...vals, stepId]);
    } else {
      const placeholders = cols.map(() => "?").join(", ");
      await db.query(
        `INSERT INTO bot_steps (id, ${cols.join(", ")}) VALUES (?, ${placeholders})`,
        [stepId, ...vals],
      );
    }

    const rows = (await db.query("SELECT * FROM bot_steps WHERE id = ?", [stepId])) as any[];
    return { ok: true, step: rows?.[0] ?? null };
  });

export const deleteBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM bot_steps WHERE id = ?", [data.id]);
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
