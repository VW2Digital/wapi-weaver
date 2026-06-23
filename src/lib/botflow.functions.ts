

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";

export const getBotSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    // Para simplificar na Fase 1, pega a primeira instância configurada no profile
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id)
      return { ok: false, error: "Nenhuma instância WhatsApp configurada no perfil." };

    let { data: settings } = await context.db
      .from("bot_settings")
      .select("*")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) {
      // Cria a configuração padrão se não existir
      const { data: newSettings, error } = await context.db
        .from("bot_settings")
        .insert({
          id: crypto.randomUUID(),
          user_id: context.user.id,
          instance_id: p.whatsapp_phone_number_id,
          is_active: false,
          pause_timeout_minutes: 60,
        })
        .select("*")
        .single();

      if (error) return { ok: false, error: error.message };
      settings = newSettings;
    }

    return { ok: true, settings };
  });

export const toggleBotStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância configurada." };

    const { error } = await context.db
      .from("bot_settings")
      .update({ is_active: data.isActive })
      .eq("instance_id", p.whatsapp_phone_number_id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const listBotSteps = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return [];

    const { data: settings } = await context.db
      .from("bot_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) return [];

    const { data } = await context.db
      .from("bot_steps")
      .select("*")
      .eq("bot_settings_id", settings.id)
      .order("step_order", { ascending: true });

    return data || [];
  });

const saveBotStepInput = z.object({
  id: z.string().optional(),
  step_order: z.number(),
  trigger_type: z.string(),
  trigger_value: z.string().optional(),
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
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    let { data: settings } = await context.db
      .from("bot_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) {
      const { data: newSettings, error: createError } = await context.db
        .from("bot_settings")
        .insert({
          id: crypto.randomUUID(),
          user_id: context.user.id,
          instance_id: p.whatsapp_phone_number_id,
          is_active: false,
          pause_timeout_minutes: 60,
        })
        .select("id")
        .single();

      if (createError) return { ok: false, error: "Não foi possível criar as configurações do bot: " + createError.message };
      settings = newSettings;
    }

    const incomingIds = data.map(s => s.id).filter(Boolean);

    // Delete steps not in incoming list
    if (incomingIds.length > 0) {
      await context.db
        .from("bot_steps")
        .delete()
        .eq("bot_settings_id", settings.id)
        .not("id", "in", `(${incomingIds.map(id => `"${id}"`).join(",")})`);
    } else {
       await context.db
        .from("bot_steps")
        .delete()
        .eq("bot_settings_id", settings.id);
    }

    // Upsert remaining
    for (const step of data) {
      const payload = {
        bot_settings_id: settings.id,
        step_order: step.step_order,
        trigger_type: step.trigger_type,
        trigger_value: step.trigger_value || null,
        message_type: step.message_type || "text",
        message_content: step.message_content || null,
        media_url: step.media_url || null,
        media_caption: step.media_caption || null,
        buttons_config: step.buttons_config || null,
        next_step_id: step.next_step_id || null,
        position_x: step.position_x || 0,
        position_y: step.position_y || 0,
      };

      if (step.id) {
        await context.db.from("bot_steps").update(payload).eq("id", step.id);
      } else {
        await context.db.from("bot_steps").insert({ id: crypto.randomUUID(), user_id: context.user.id, ...payload });
      }
    }

    return { ok: true };
  });

export const saveBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveBotStepInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    let { data: settings } = await context.db
      .from("bot_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) {
      const { data: newSettings, error: createError } = await context.db
        .from("bot_settings")
        .insert({
          id: crypto.randomUUID(),
          user_id: context.user.id,
          instance_id: p.whatsapp_phone_number_id,
          is_active: false,
          pause_timeout_minutes: 60,
        })
        .select("id")
        .single();

      if (createError) return { ok: false, error: "Não foi possível criar as configurações do bot: " + createError.message };
      settings = newSettings;
    }

    const payload = {
      bot_settings_id: settings.id,
      step_order: data.step_order,
      trigger_type: data.trigger_type,
      trigger_value: data.trigger_value || null,
      message_type: data.message_type || "text",
      message_content: data.message_content || null,
      media_url: data.media_url || null,
      media_caption: data.media_caption || null,
      buttons_config: data.buttons_config || null,
      next_step_id: data.next_step_id || null,
    };

    let result;
    if (data.id) {
      result = await context.db
        .from("bot_steps")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
    } else {
      result = await context.db
        .from("bot_steps")
        .insert({ id: crypto.randomUUID(), user_id: context.user.id, ...payload })
        .select("*")
        .single();
    }

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, step: result.data };
  });

export const deleteBotStep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { error } = await context.db.from("bot_steps").delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
