import { dbAdmin } from "@/integrations/mysql/client.server";
import { normalizeWaMessageId } from "@/lib/wa-message-id";

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
  buttonPayload?: string,
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
    let stepToExecute: any = null;

    // 0. Check if buttonPayload has step routing
    let targetStepId = "";
    if (buttonPayload) {
      if (buttonPayload.startsWith("step:")) {
        targetStepId = buttonPayload.replace("step:", "");
      } else {
        // Fallback for legacy UUIDs or sentinels directly set as ID
        targetStepId = buttonPayload;
      }
    }

    if (targetStepId) {
      if (targetStepId === "-999") {
        // Handoff: Pause the bot
        const updateData = {
          current_step_id: null,
          last_interaction: new Date().toISOString(),
          is_paused: true,
          paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
        logInfo("Handoff direto pelo botão clicado");
        return;
      } else if (targetStepId === "-997") {
        // Restart: Find start step
        const { data: startStep } = await dbAdmin
          .from("bot_steps")
          .select("*")
          .eq("user_id", userId)
          .eq("bot_settings_id", settings.id)
          .eq("trigger_type", "start")
          .maybeSingle();
        if (startStep) stepToExecute = startStep;
      } else {
        // Find the specific step by ID
        const { data: targetStep } = await dbAdmin
          .from("bot_steps")
          .select("*")
          .eq("id", targetStepId)
          .maybeSingle();
        if (targetStep) stepToExecute = targetStep;
      }
    }

    // A. Check for global keyword overrides first
    if (!stepToExecute) {
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

    // Handoff state info
    const isHandoff = stepToExecute.next_step_id === "-999";
    const isFlow = stepToExecute.message_type === "whatsapp_flow";
    const updateData = {
      current_step_id: isFlow 
        ? stepToExecute.id 
        : (isHandoff ? null : stepToExecute.next_step_id || null),
      last_interaction: new Date().toISOString(),
      ...(isHandoff
        ? {
            is_paused: true,
            paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }
        : {}),
    };

    const commitState = async () => {
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
    };

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
    } else if (stepToExecute.message_type === "whatsapp_flow") {
      payload.type = "interactive";
      let flowId = "";
      let flowCta = "Abrir Formulário";
      
      if (stepToExecute.buttons_config) {
        try {
          const configObj = typeof stepToExecute.buttons_config === "string"
            ? JSON.parse(stepToExecute.buttons_config)
            : stepToExecute.buttons_config;
          flowId = configObj?.flow_id || "";
          flowCta = configObj?.flow_cta || configObj?.cta || "Abrir Formulário";
        } catch (e) {
          logError("Erro ao processar buttons_config do whatsapp_flow", e);
        }
      }

      const interactivePayload: any = {
        type: "flow",
        body: {
          text: stepToExecute.message_content || "Por favor, preencha o formulário para continuar."
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: `session:${phoneDigits}:${stepToExecute.id}`,
            flow_id: flowId,
            flow_cta: flowCta,
            flow_action: "navigate",
            flow_action_payload: {
              screen: "INIT"
            }
          }
        }
      };

      if (stepToExecute.footer_text) {
        interactivePayload.footer = { text: stepToExecute.footer_text };
      }

      payload.interactive = interactivePayload;
    } else if (["image", "audio", "video", "document"].includes(stepToExecute.message_type)) {
      payload.type = stepToExecute.message_type;
      payload[stepToExecute.message_type] = {
        link: stepToExecute.media_url || "",
      };
      if (stepToExecute.media_caption && stepToExecute.message_type !== "audio") {
        payload[stepToExecute.message_type].caption = stepToExecute.media_caption;
      }
    } else if (
      ["button", "buttons", "list", "cta_url", "product", "product_list", "catalog_message"].includes(
        stepToExecute.message_type,
      )
    ) {
      payload.type = "interactive";
      let interactivePayload: any = { type: stepToExecute.message_type === "buttons" ? "button" : stepToExecute.message_type };
      
      if (stepToExecute.buttons_config) {
        const parsed = typeof stepToExecute.buttons_config === "string"
            ? JSON.parse(stepToExecute.buttons_config)
            : stepToExecute.buttons_config;
        interactivePayload = { ...interactivePayload, ...parsed };
      }

      if (stepToExecute.message_content && !interactivePayload.body) {
        interactivePayload.body = { text: stepToExecute.message_content };
      }
      if (stepToExecute.footer_text && !interactivePayload.footer) {
        interactivePayload.footer = { text: stepToExecute.footer_text };
      }
      if (interactivePayload.type === "buttons") interactivePayload.type = "button";

      // Suporte a cabeçalho de mídia nativo da Graph API (ex: image + buttons)
      if (stepToExecute.media_url) {
        let mediaType = "image";
        const lowerUrl = stepToExecute.media_url.toLowerCase();
        if (lowerUrl.endsWith(".mp4")) mediaType = "video";
        else if (lowerUrl.endsWith(".pdf")) mediaType = "document";
        else if (lowerUrl.endsWith(".mp3") || lowerUrl.endsWith(".ogg")) mediaType = "audio";
        
        if (mediaType !== "audio") {
          interactivePayload.header = {
            type: mediaType,
            [mediaType]: { link: stepToExecute.media_url }
          };
        } else {
          // Para Áudio, a Meta não permite como header. Enviamos uma mensagem de áudio solta antes!
          try {
            await fetch(`https://graph.facebook.com/${p.meta_graph_version || "v21.0"}/${phoneNumberId}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${p.whatsapp_access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phoneDigits,
                type: "audio",
                audio: { link: stepToExecute.media_url },
              }),
            });
            // Pequeno delay para a ordem no WhatsApp
            await new Promise(res => setTimeout(res, 500));
          } catch (e) {
            logError("Erro ao enviar audio avulso", e);
          }
        }
      }

      payload.interactive = interactivePayload;
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    let isSuccess = false;
    let waMessageId: string | null = null;
    
    try {
      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        isSuccess = true;
        try {
          const responseJson = await r.json();
          waMessageId = normalizeWaMessageId(responseJson?.messages?.[0]?.id) || null;
        } catch (e) {
          // Ignore
        }
      } else {
        const errBody = await r.text();
        logError("Erro ao enviar mensagem do bot", { errBody });
        
        if (process.env.NODE_ENV === "development" || p.whatsapp_access_token === "mock_token" || phoneDigits === "5511999999999") {
          logInfo("[DEV MODE] Prosseguindo com a atualização de estado mesmo com erro na Graph API");
          isSuccess = true;
          waMessageId = "wam.mock_dev_" + Date.now();
        }
      }
    } catch (e: any) {
      logError("Erro de rede ao enviar mensagem do bot", { error: e?.message });
      
      if (process.env.NODE_ENV === "development" || p.whatsapp_access_token === "mock_token" || phoneDigits === "5511999999999") {
        logInfo("[DEV MODE] Prosseguindo com a atualização de estado mesmo com falha de rede na Graph API");
        isSuccess = true;
        waMessageId = "wam.mock_net_dev_" + Date.now();
      } else {
        throw e;
      }
    }

    if (isSuccess) {
      // 5. Update state
      await commitState();

      // 6. Log the outgoing message in direct_messages
      try {
        let type = "text";
        let bodyText = stepToExecute.message_content || "";
        
        if (["image", "audio", "video", "document"].includes(stepToExecute.message_type)) {
          type = stepToExecute.message_type;
          bodyText = stepToExecute.media_url || "";
        }

        await dbAdmin.from("direct_messages").insert({
          user_id: userId,
          contact_phone: phoneDigits,
          direction: "outgoing",
          type,
          body: bodyText,
          wa_message_id: waMessageId,
          status: "sent",
          metadata: {
            step_id: stepToExecute.id,
            bot_triggered: true,
            payload
          }
        });
        logInfo("Mensagem enviada pelo bot salva em direct_messages", { waMessageId });
      } catch (logErr: any) {
        logError("Erro ao gravar mensagem enviada pelo bot em direct_messages", { error: logErr.message });
      }
    }
  } catch (err: any) {
    logError("Exceção fatal no processBotFlow", { error: err.message });
  }
}
