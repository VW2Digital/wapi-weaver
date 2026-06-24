

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";

async function getOrCreateBotSettings(context: any) {
  const { data: p } = await context.db
    .from("profiles")
    .select("whatsapp_phone_number_id")
    .eq("id", context.userId)
    .maybeSingle();

  let { data: settings } = await context.db
    .from("bot_settings")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (!settings) {
    const { data: newSettings, error } = await context.db
      .from("bot_settings")
      .insert({
        id: crypto.randomUUID(),
        user_id: context.userId,
        instance_id: p?.whatsapp_phone_number_id || null,
        is_active: false,
        pause_timeout_minutes: 60,
      })
      .select("*")
      .single();

    if (error) return { ok: false as const, error: error.message };
    settings = newSettings;
  } else if (p?.whatsapp_phone_number_id && settings.instance_id !== p.whatsapp_phone_number_id) {
    const { data: updatedSettings, error } = await context.db
      .from("bot_settings")
      .update({ instance_id: p.whatsapp_phone_number_id })
      .eq("id", settings.id)
      .select("*")
      .single();

    if (error) return { ok: false as const, error: error.message };
    settings = updatedSettings;
  }

  return { ok: true as const, settings, profile: p };
}

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;
    return { ok: true, settings: result.settings };
  });

export const toggleBotStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;

    const { error } = await context.db
      .from("bot_settings")
      .update({
        is_active: data.isActive,
        instance_id: result.profile?.whatsapp_phone_number_id || result.settings.instance_id || null,
      })
      .eq("id", result.settings.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const listBotSteps = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return [];

    const { data } = await context.db
      .from("bot_steps")
      .select("*")
      .eq("bot_settings_id", result.settings.id)
      .order("step_order", { ascending: true });

    return data || [];
  });

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
});

const saveBotStepsBatchInput = z.array(saveBotStepInput);

export const saveBotStepsBatch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepsBatchInput.parse(d))
  .handler(async ({ data, context }: { data: any[]; context: any }) => {
    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;

    const settings = result.settings;
    const incomingIds = data.map(s => s.id).filter(Boolean);

    // Delete steps not in incoming list
    if (incomingIds.length > 0) {
      const { error: deleteError } = await context.db
        .from("bot_steps")
        .delete()
        .eq("bot_settings_id", settings.id)
        .not("id", "in", `(${incomingIds.map(id => `"${id}"`).join(",")})`);
      if (deleteError) {
        return { ok: false, error: `Falha ao remover passos antigos: ${deleteError.message}` };
      }
    } else {
      const { error: deleteAllError } = await context.db
        .from("bot_steps")
        .delete()
        .eq("bot_settings_id", settings.id);
      if (deleteAllError) {
        return { ok: false, error: `Falha ao limpar passos antigos: ${deleteAllError.message}` };
      }
    }

    // Primeira passada: cria/atualiza os steps SEM next_step_id para não quebrar FK
    for (const step of data) {
      const basePayload = {
        bot_settings_id: settings.id,
        step_order: step.step_order,
        trigger_type: step.trigger_type,
        trigger_value: step.trigger_value || null,
        message_type: step.message_type || "text",
        message_content: step.message_content || null,
        media_url: step.media_url || null,
        media_caption: step.media_caption || null,
        footer_text: step.footer_text || null,
        buttons_config: step.buttons_config || null,
        next_step_id: null,
        delay_seconds: Number(step.delay_seconds || 0),
        position_x: step.position_x || 0,
        position_y: step.position_y || 0,
        assign_team_id: step.assign_team_id || null,
        assign_user_id: step.assign_user_id || null,
        handoff_message: step.handoff_message || null,
        card_color: step.card_color || null,
      };

      if (step.id) {
        const { data: existing } = await context.db
          .from("bot_steps")
          .select("id")
          .eq("id", step.id)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await context.db.from("bot_steps").update(basePayload).eq("id", step.id);
          if (error) {
            return { ok: false, error: `Falha ao atualizar passo ${step.step_order}: ${error.message}` };
          }
        } else {
          const { error } = await context.db.from("bot_steps").insert({
            id: step.id,
            user_id: context.userId,
            ...basePayload,
          });
          if (error) {
            return { ok: false, error: `Falha ao inserir passo ${step.step_order}: ${error.message}` };
          }
        }
      } else {
        const { error } = await context.db.from("bot_steps").insert({
          id: crypto.randomUUID(),
          user_id: context.userId,
          ...basePayload,
        });
        if (error) {
          return { ok: false, error: `Falha ao inserir passo ${step.step_order}: ${error.message}` };
        }
      }
    }

    // Segunda passada: resolve links entre steps quando todos já existem
    for (const step of data) {
      if (!step.id) continue;
      const linkPayload = {
        next_step_id: step.next_step_id || null,
      };
      const { error } = await context.db.from("bot_steps").update(linkPayload).eq("id", step.id);
      if (error) {
        return {
          ok: false,
          error: `Falha ao vincular destino do passo ${step.step_order}: ${error.message}`,
        };
      }
    }

    return { ok: true };
  });

export const saveBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const result = await getOrCreateBotSettings(context);
    if (!result.ok) return result;

    const payload = {
      bot_settings_id: result.settings.id,
      step_order: data.step_order,
      trigger_type: data.trigger_type,
      trigger_value: data.trigger_value || null,
      message_type: data.message_type || "text",
      message_content: data.message_content || null,
      media_url: data.media_url || null,
      media_caption: data.media_caption || null,
      footer_text: data.footer_text || null,
      buttons_config: data.buttons_config || null,
      next_step_id: data.next_step_id || null,
      delay_seconds: Number(data.delay_seconds || 0),
      position_x: data.position_x || 0,
      position_y: data.position_y || 0,
      assign_team_id: data.assign_team_id || null,
      assign_user_id: data.assign_user_id || null,
      handoff_message: data.handoff_message || null,
      card_color: data.card_color || null,
    };

    let saveResult;
    if (data.id) {
      const { data: existing } = await context.db
        .from("bot_steps")
        .select("id")
        .eq("id", data.id)
        .maybeSingle();

      if (existing?.id) {
        saveResult = await context.db
          .from("bot_steps")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single();
      } else {
        saveResult = await context.db
          .from("bot_steps")
          .insert({ id: data.id, user_id: context.userId, ...payload })
          .select("*")
          .single();
      }
    } else {
      saveResult = await context.db
        .from("bot_steps")
        .insert({ id: crypto.randomUUID(), user_id: context.userId, ...payload })
        .select("*")
        .single();
    }

    if (saveResult.error) return { ok: false, error: saveResult.error.message };
    return { ok: true, step: saveResult.data };
  });

export const deleteBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { error } = await context.db.from("bot_steps").delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
