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
  channel: "whatsapp" | "instagram" = "whatsapp",
) {
  if (!phoneNumberId || !phoneDigits || !userId || !messageBody) return;

  try {
    // 1. Localizar todos os fluxos (bot_settings) ativos para o canal
    let { data: flows } = await dbAdmin
      .from("bot_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", channel)
      .eq("is_active", true);

    if (!flows || flows.length === 0) {
      logInfo("Nenhum fluxo de bot ativo configurado para o canal", { channel });
      return;
    }

    // Filtrar por instance_id se configurado para evitar compartilhamento indevido
    flows = flows.filter((f: any) => !f.instance_id || f.instance_id === phoneNumberId);

    if (flows.length === 0) {
      logInfo("Nenhum fluxo ativo correspondente a esta conta/instância", { phoneNumberId });
      return;
    }

    // Ordenar fluxos por prioridade decrescente
    const sortedFlows = [...flows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 2. Verificar estado da conversa
    const { data: state } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .eq("channel", channel)
      .maybeSingle();

    if (state && !state.bot_active) {
      logInfo("Bot desativado manualmente para este contato", { phoneDigits });
      return;
    }

    if (state && state.is_paused) {
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

    // 3. Escolher o fluxo correto com base na nova regra de precedência
    let activeFlow = sortedFlows[0];
    let stepToExecute: any = null;

    // Buscar todos os passos ativos do canal
    const { data: allSteps } = await dbAdmin
      .from("bot_steps")
      .select("*")
      .eq("user_id", userId)
      .in("bot_settings_id", sortedFlows.map((f: any) => f.id));

    // Determinar expiração da sessão (24 horas)
    let isSessionExpired = false;
    if (state && state.last_interaction) {
      const lastInt = new Date(state.last_interaction);
      if (Date.now() - lastInt.getTime() > 24 * 60 * 60 * 1000) {
        isSessionExpired = true;
      }
    }

    // Comandos de interrupção explícita
    const globalInterruptionKeywords = ["menu", "início", "inicio", "atendente", "humano", "cancelar", "reiniciar"];
    const isInterruption = globalInterruptionKeywords.includes(messageBody.trim().toLowerCase());

    // Regra 1: Se existe sessão ativa para a conversa (e não é comando global de interrupção nem está expirada), continuar o fluxo atual
    if (state && state.current_step_id && !isSessionExpired && !isInterruption) {
      const queuedStep = allSteps?.find((s: any) => s.id === state.current_step_id);
      if (queuedStep) {
        stepToExecute = queuedStep;
        activeFlow = sortedFlows.find((f: any) => f.id === queuedStep.bot_settings_id) || activeFlow;
      }
    }

    // Regra 2: Processar interrupção global
    if (!stepToExecute) {
      if (isInterruption) {
        logInfo("Interrupção global do bot solicitada pelo usuário", { messageBody });
        
        // Se for comando de handoff/atendente humano, pausamos o bot
        if (["atendente", "humano"].includes(messageBody.trim().toLowerCase())) {
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
              channel,
              ...updateData,
            });
          }
          logInfo("Handoff manual acionado por palavra-chave global.");
          return;
        }
      }

      // Regra 3, 4 & 5: Aplicar palavra-chave para iniciar novo fluxo (ordenado por priority DESC)
      const keywordMatch = sortedFlows.find((f: any) => {
        if (f.trigger_type === "keyword" && f.trigger_value) {
          return messageBody.toLowerCase() === f.trigger_value.toLowerCase();
        }
        const startStep = allSteps?.find((s: any) => s.bot_settings_id === f.id && s.trigger_type === "keyword");
        return startStep?.trigger_value && messageBody.toLowerCase() === startStep.trigger_value.toLowerCase();
      });

      if (keywordMatch) {
        activeFlow = keywordMatch;
        const startStep = allSteps?.find((s: any) => s.bot_settings_id === activeFlow.id && (s.trigger_type === "keyword" || s.trigger_type === "start"));
        if (startStep) stepToExecute = startStep;
      }

      // Regra 6: Usar fluxo padrão (is_default = true) se nenhum for compatível
      if (!stepToExecute) {
        const defaultFlow = sortedFlows.find((f: any) => f.is_default);
        if (defaultFlow) {
          activeFlow = defaultFlow;
          const startStep = allSteps?.find((s: any) => s.bot_settings_id === activeFlow.id && s.trigger_type === "start");
          if (startStep) stepToExecute = startStep;
        }
      }
    }

    // Regra 7: Se nenhum fluxo compatível for encontrado, salvar a mensagem e deixar para atendimento humano
    if (!stepToExecute) {
      logInfo("Nenhum fluxo compatível encontrado. Mensagem deixada para atendimento humano.", { messageBody });
      return;
    }

    // Se nenhum step ou fluxo puder ser mapeado, encerra ou transfere para IA
    if (!stepToExecute) {
      logInfo("Nenhum step aplicável. Tentando Agente de IA...", { messageBody });
      const { processAiAgent } = await import("./ai-agent.server");
      const handledByAi = await processAiAgent(messageBody, phoneDigits, phoneNumberId, userId);
      if (handledByAi) {
        await dbAdmin.from("bot_conversation_state").upsert(
          {
            user_id: userId,
            contact_number: phoneDigits,
            instance_id: phoneNumberId,
            channel,
            last_interaction: new Date().toISOString(),
          },
          { onConflict: "user_id,contact_number,instance_id,channel" },
        );
      }
      return;
    }

    logInfo("Executando step do bot", { stepId: stepToExecute.id, flowId: activeFlow.id, messageBody });

    const isHandoff = stepToExecute.next_step_id === "-999";
    const updateData = {
      current_step_id: isHandoff ? null : stepToExecute.next_step_id || null,
      last_interaction: new Date().toISOString(),
      ...(isHandoff
        ? {
            is_paused: true,
            paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }
        : {}),
    };

    const commitState = async () => {
      await dbAdmin.from("bot_conversation_state").upsert(
        {
          user_id: userId,
          contact_number: phoneDigits,
          instance_id: phoneNumberId,
          channel,
          ...updateData,
        },
        { onConflict: "user_id,contact_number,instance_id,channel" },
      );
    };

    // 4. Disparar o envio da mensagem para o canal correto
    let isSuccess = false;
    let providerMsgId: string | null = null;

    if (channel === "whatsapp") {
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
        payload[stepToExecute.message_type] = { link: stepToExecute.media_url || "" };
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
        isSuccess = true;
        const resJson = await r.json();
        providerMsgId = normalizeWaMessageId(resJson?.messages?.[0]?.id) || null;
      }
    } else if (channel === "instagram") {
      const { data: igAcc } = await dbAdmin
        .from("instagram_accounts")
        .select("access_token")
        .eq("ig_user_id", phoneNumberId)
        .maybeSingle();

      if (!igAcc || !igAcc.access_token) {
        logError("Acesso ao Instagram não configurado ou token expirado");
        return;
      }

      const igRecipientId = phoneDigits.startsWith("ig_") ? phoneDigits.slice(3) : phoneDigits;
      const apiVersion = process.env.META_GRAPH_VERSION || "v21.0";

      const payload = {
        recipient: { id: igRecipientId },
        message: { text: stepToExecute.message_content || "" },
      };

      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${igAcc.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        isSuccess = true;
        const resJson = await r.json();
        providerMsgId = resJson?.message_id || null;
      } else {
        const errText = await r.text();
        logError("Erro ao enviar mensagem no Instagram", errText);
      }
    }

    if (isSuccess) {
      await commitState();

      await dbAdmin.from("direct_messages").insert({
        user_id: userId,
        contact_phone: phoneDigits,
        direction: "outgoing",
        type: "text",
        body: stepToExecute.message_content || "",
        channel,
        provider_message_id: providerMsgId,
        provider_account_id: phoneNumberId,
        status: "sent",
        metadata: {
          step_id: stepToExecute.id,
          bot_triggered: true,
        },
      });
      logInfo("Mensagem enviada pelo bot salva no banco", { providerMsgId });
    }
  } catch (err: any) {
    logError("Exceção fatal no processBotFlow", { error: err.message });
  }
}
