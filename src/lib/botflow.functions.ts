import { dbAdmin } from "@/integrations/mysql/client.server";

function logInfo(message: string, data?: any) {
  console.log(`[botflow] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[botflow] ${message}`, data ? JSON.stringify(data) : "");
}

export async function processBotFlow(
  messageBody: string,
  phoneDigits: string,
  phoneNumberId: string,
  userId: string,
) {
  if (!phoneNumberId || !phoneDigits || !userId || !messageBody) return;

  try {
    // 1. Check if bot is active for this instance
    const { data: settings } = await dbAdmin
      .from("bot_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("instance_id", phoneNumberId)
      .maybeSingle();

    if (!settings || !settings.is_active) {
      logInfo("Bot desativado ou não configurado para a instância", { phoneNumberId });
      return;
    }

    // 2. Check conversation state
    const { data: state } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .eq("instance_id", phoneNumberId)
      .maybeSingle();

    if (state && !state.bot_active) {
      logInfo("Bot desativado manualmente para este contato", { phoneDigits });
      return;
    }

    if (state && state.is_paused) {
      // Check if pause timeout expired
      const pausedUntil = state.paused_until ? new Date(state.paused_until) : new Date(0);
      if (new Date() < pausedUntil) {
        logInfo("Bot pausado para este contato", { phoneDigits, pausedUntil });
        return;
      } else {
        logInfo("Pausa do bot expirou, retomando...", { phoneDigits });
        await dbAdmin
          .from("bot_conversation_state")
          .update({ is_paused: false, paused_until: null })
          .eq("id", state.id);
      }
    }

    // 3. Find next step
    // Simplified logic for Phase 1:
    // Always find a step where trigger_value == messageBody OR trigger_type = 'start' if no state

    const nextStepQuery = dbAdmin
      .from("bot_steps")
      .select("*")
      .eq("user_id", userId)
      .eq("bot_settings_id", settings.id);

    let stepToExecute: any = null;

    // A. Check for global keyword overrides first
    const { data: keywordSteps } = await dbAdmin
      .from("bot_steps")
      .select("*")
      .eq("user_id", userId)
      .eq("bot_settings_id", settings.id)
      .eq("trigger_type", "keyword");

    if (keywordSteps && keywordSteps.length > 0) {
      const matched = keywordSteps.find(
        (s: any) => s.trigger_value && messageBody.toLowerCase() === s.trigger_value.toLowerCase(),
      );
      if (matched) stepToExecute = matched;
    }

    // B. If no keyword, check if there's a queued step in the state
    if (!stepToExecute && state && state.current_step_id) {
      const { data: queuedStep } = await dbAdmin
        .from("bot_steps")
        .select("*")
        .eq("id", state.current_step_id)
        .maybeSingle();
      if (queuedStep) stepToExecute = queuedStep;
    }

    // C. If still no step, check if it's a new conversation (no state) or expired session
    // For Phase 1, we consider a session expired if last_interaction is older than 24h
    let isSessionExpired = false;
    if (state && state.last_interaction) {
      const lastInt = new Date(state.last_interaction);
      if (Date.now() - lastInt.getTime() > 24 * 60 * 60 * 1000) {
        isSessionExpired = true;
      }
    }

    if (!stepToExecute && (!state || isSessionExpired)) {
      const { data: startStep } = await dbAdmin
        .from("bot_steps")
        .select("*")
        .eq("user_id", userId)
        .eq("bot_settings_id", settings.id)
        .eq("trigger_type", "start")
        .maybeSingle();
      if (startStep) stepToExecute = startStep;
    }

    if (!stepToExecute) {
      logInfo("Nenhum step aplicável. Tentando Agente de IA...", { messageBody });
      const { processAiAgent } = await import("./ai-agent.functions");
      const handledByAi = await processAiAgent(messageBody, phoneDigits, phoneNumberId, userId);
      if (!handledByAi) {
        logInfo("IA não lidou com a mensagem (desativada, erro ou sem apiKey).", { messageBody });
      }
      // Se a IA respondeu, atualizamos a última interação
      if (handledByAi) {
         if (state) {
            await dbAdmin.from("bot_conversation_state").update({ last_interaction: new Date().toISOString() }).eq("id", state.id);
         } else {
            await dbAdmin.from("bot_conversation_state").insert({
              user_id: userId,
              contact_number: phoneDigits,
              instance_id: phoneNumberId,
              last_interaction: new Date().toISOString()
            });
         }
      }
      return;
    }

    logInfo("Executando step do bot", { stepId: stepToExecute.id, messageBody });

    // 4. Send the message via Graph API
    // Get access token
    const { data: p } = await dbAdmin
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", userId)
      .maybeSingle();

    if (!p || !p.whatsapp_access_token) return;

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneDigits,
    };

    if (!stepToExecute.message_type || stepToExecute.message_type === "text") {
      payload.type = "text";
      payload.text = { body: stepToExecute.message_content || "" };
    } else if (["image", "audio", "video", "document"].includes(stepToExecute.message_type)) {
      payload.type = stepToExecute.message_type;
      payload[stepToExecute.message_type] = {
        link: stepToExecute.media_url || "",
      };
      if (stepToExecute.media_caption && stepToExecute.message_type !== "audio") {
        payload[stepToExecute.message_type].caption = stepToExecute.media_caption;
      }
    } else if (["button", "buttons", "list", "interactive"].includes(stepToExecute.message_type)) {
      payload.type = "interactive";
      if (stepToExecute.buttons_config) {
        payload.interactive =
          typeof stepToExecute.buttons_config === "string"
            ? JSON.parse(stepToExecute.buttons_config)
            : stepToExecute.buttons_config;
      }
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      // 5. Update state
      const isHandoff = stepToExecute.next_step_id === "-999";

      const updateData = {
        current_step_id: isHandoff ? null : stepToExecute.next_step_id || null,
        last_interaction: new Date().toISOString(),
        ...(isHandoff
          ? {
              is_paused: true,
              paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Pause for 24h on handoff
            }
          : {}),
      };

      if (state) {
        await dbAdmin.from("bot_conversation_state").update(updateData).eq("id", state.id);
      } else {
        await dbAdmin.from("bot_conversation_state").insert({
          user_id: userId,
          contact_number: phoneDigits,
          instance_id: phoneNumberId,
          ...updateData,
        });
      }
    } else {
      const errBody = await r.text();
      logError("Erro ao enviar mensagem do bot", { errBody });
    }
  } catch (err: any) {
    logError("Exceção fatal no processBotFlow", { error: err.message });
  }
}

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

    const { data: settings } = await context.db
      .from("bot_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) return { ok: false, error: "Settings não encontradas." };

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
