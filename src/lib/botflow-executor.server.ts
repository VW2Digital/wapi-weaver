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
  channel: "whatsapp" | "instagram" | "messenger" | "whatsapp_group" = "whatsapp",
) {
  if (!phoneNumberId || !phoneDigits || !userId || !messageBody) return;

  const { checkLicense } = await import("@/lib/license-verifier");
  const isLicenseValid = await checkLicense(undefined, false);
  if (!isLicenseValid) {
    logError("Processamento de fluxo de bot abortado por licença inválida ou ausente.");
    return;
  }

  try {
    // 1. Localizar todos os fluxos (bot_settings) ativos para o canal
    let { data: flows } = await dbAdmin
      .from("bot_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", channel);

    if (!flows || flows.length === 0) {
      logInfo("Nenhuma configuração de bot encontrada para o canal", { channel });
      return;
    }

    const { data: builderFlows } = await dbAdmin
      .from("bot_flows")
      .select("id, name, channel, is_active, last_executed_at")
      .eq("tenant_id", userId)
      .eq("channel", channel);
    const activeBuilderFlowIds = new Set(
      (builderFlows || []).filter((f: any) => Boolean(f.is_active)).map((f: any) => f.id),
    );

    // O status individual do fluxo é a fonte de verdade no construtor novo.
    // bot_settings.is_active continua valendo para fluxos legados, mas não pode
    // bloquear um fluxo que aparece como ativo na tela.
    const hasActiveLegacySettings = flows.some((flow: any) => Boolean(flow.is_active));
    if (!hasActiveLegacySettings && activeBuilderFlowIds.size === 0) {
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
    const { data: loadedSteps } = await dbAdmin
      .from("bot_steps")
      .select("*")
      .eq("user_id", userId)
      .in(
        "bot_settings_id",
        sortedFlows.map((f: any) => f.id),
      );

    // Os fluxos criados pelo construtor ficam em bot_flows e compartilham o
    // mesmo bot_settings. Respeitar o flow_id/is_active evita executar passos
    // de outro fluxo (ou de um fluxo que foi desativado na listagem).
    const allSteps = (loadedSteps || []).filter(
      (step: any) =>
        (step.flow_id && activeBuilderFlowIds.has(step.flow_id)) ||
        (!step.flow_id && hasActiveLegacySettings),
    );
    const normalizeTriggerValue = (value: unknown) =>
      String(value ?? "").trim().toLocaleLowerCase("pt-BR");
    const findFlowForStep = (step: any) =>
      (step?.flow_id && (builderFlows || []).find((f: any) => f.id === step.flow_id)) ||
      sortedFlows.find((f: any) => f.id === step?.bot_settings_id) ||
      activeFlow;

    // Determinar expiração da sessão (24 horas)
    let isSessionExpired = false;
    if (state && state.last_interaction) {
      const lastInt = new Date(state.last_interaction);
      if (Date.now() - lastInt.getTime() > 24 * 60 * 60 * 1000) {
        isSessionExpired = true;
      }
    }

    // Comandos de interrupção explícita
    const globalInterruptionKeywords = [
      "menu",
      "início",
      "inicio",
      "atendente",
      "humano",
      "cancelar",
      "reiniciar",
    ];
    const isInterruption = globalInterruptionKeywords.includes(messageBody.trim().toLowerCase());

    // Processamento de botão interativo (alta precedência)
    let isButtonRedirect = false;
    if (buttonPayload && buttonPayload.startsWith("step:")) {
      const parts = buttonPayload.split(":");
      const rawDest = parts[1] || "";
      let nextStepId: string | null = null;
      if (rawDest && rawDest !== "none") {
        nextStepId = rawDest;
      }

      let assignTeamId: string | null = null;
      let assignAgentId: string | null = null;
      for (let i = 2; i < parts.length; i += 2) {
        if (parts[i] === "team") assignTeamId = parts[i + 1] || null;
        else if (parts[i] === "agent") assignAgentId = parts[i + 1] || null;
      }

      // Executa a atribuição se fornecida
      if (assignTeamId || assignAgentId) {
        try {
          await dbAdmin
            .from("conversation_assignments")
            .update({ is_active: false, unassigned_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("contact_phone", phoneDigits)
            .eq("is_active", true);

          let finalAgentId = assignAgentId;
          if (assignTeamId && !finalAgentId) {
            const { default: db } = await import("./db");
            const agents: any = await db.query(
              `SELECT tm.user_id as agent_id, COUNT(ca.id) as active_chats
               FROM team_members tm
               LEFT JOIN conversation_assignments ca 
                 ON ca.agent_id = tm.user_id AND ca.is_active = true AND ca.user_id = ?
               WHERE tm.team_id = ?
               GROUP BY tm.user_id
               ORDER BY active_chats ASC, RAND()
               LIMIT 1`,
              [userId, assignTeamId],
            );
            if (agents && agents.length > 0) {
              finalAgentId = agents[0].agent_id;
            }
          }

          const { randomUUID } = await import("crypto");
          await dbAdmin.from("conversation_assignments").insert({
            id: randomUUID(),
            user_id: userId,
            contact_phone: phoneDigits,
            team_id: assignTeamId,
            agent_id: finalAgentId || null,
            assigned_by: null,
            is_active: true,
          });
        } catch (err: any) {
          logError("Erro ao processar atribuição do botão", { error: err.message });
        }
      }

      if (nextStepId === "-999") {
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
            tenant_id: userId,
            contact_number: phoneDigits,
            instance_id: phoneNumberId,
            channel,
            ...updateData,
          });
        }
        logInfo("Handoff manual acionado por botão interativo.");
        return;
      } else if (nextStepId === "-997") {
        stepToExecute = null;
        isButtonRedirect = true;
      } else if (nextStepId) {
        const targetStep = allSteps?.find((s: any) => s.id === nextStepId);
        if (targetStep) {
          stepToExecute = targetStep;
          activeFlow =
            sortedFlows.find((f: any) => f.id === targetStep.bot_settings_id) || activeFlow;
          isButtonRedirect = true;
        }
      }
    }

    // IDs de botões/listas configurados como gatilho também podem vir puros
    // da API da Meta (sem o prefixo interno "step:").
    if (!isButtonRedirect && buttonPayload) {
      const buttonStep = allSteps.find(
        (s: any) =>
          s.trigger_type === "button" &&
          normalizeTriggerValue(s.trigger_value) === normalizeTriggerValue(buttonPayload),
      );
      if (buttonStep) {
        stepToExecute = buttonStep;
        activeFlow = findFlowForStep(buttonStep);
        isButtonRedirect = true;
      }
    }

    if (!isButtonRedirect) {
      // Regra 1: Se existe sessão ativa para a conversa (e não é comando global de interrupção nem está expirada), continuar o fluxo atual
      if (state && state.current_step_id && !isSessionExpired && !isInterruption) {
        const queuedStep = allSteps?.find((s: any) => s.id === state.current_step_id);
        if (queuedStep) {
          stepToExecute = queuedStep;
          activeFlow = findFlowForStep(queuedStep);
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
                tenant_id: userId,
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
        const keywordStep = allSteps.find(
          (s: any) =>
            s.trigger_type === "keyword" &&
            normalizeTriggerValue(s.trigger_value) === normalizeTriggerValue(messageBody),
        );

        if (keywordStep) {
          stepToExecute = keywordStep;
          activeFlow = findFlowForStep(keywordStep);
        }

        // Regra 6: Usar fluxo padrão (is_default = true) se nenhum for compatível
        if (!stepToExecute) {
          const defaultFlow = sortedFlows.find((f: any) => f.is_default);
          const startStep = allSteps.find(
            (s: any) =>
              s.trigger_type === "start" &&
              (!defaultFlow || s.bot_settings_id === defaultFlow.id),
          ) || allSteps.find((s: any) => s.trigger_type === "start");
          if (startStep) {
            stepToExecute = startStep;
            activeFlow = findFlowForStep(startStep);
          }
        }
      }
    }

    // Regra 7: Se nenhum fluxo compatível for encontrado, salvar a mensagem e deixar para atendimento humano
    if (!stepToExecute) {
      logInfo("Nenhum fluxo compatível encontrado. Mensagem deixada para atendimento humano.", {
        messageBody,
      });
      return;
    }

    // Se nenhum step ou fluxo puder ser mapeado, encerra ou transfere para IA
    if (!stepToExecute) {
      logInfo("Nenhum step aplicável. Tentando Agente de IA...", { messageBody });

      // Envia indicador de digitando (melhoria de UX)
      try {
        const { data: p } = await dbAdmin
          .from("profiles")
          .select("whatsapp_access_token, meta_graph_version")
          .eq("id", userId)
          .maybeSingle();

        if (p?.whatsapp_access_token) {
          const apiVersion = p.meta_graph_version || "v18.0";
          const typingPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneDigits,
            type: "text",
            text: { body: "_...digitando..._ ✍️" }
          };

          // Não bloqueia a execução do Gemini para responder isso
          fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${p.whatsapp_access_token}`,
            },
            body: JSON.stringify(typingPayload),
          }).catch(err => logError("Erro ao enviar typing indicator", err));
        }
      } catch (err) {
        logError("Exceção ao tentar enviar typing indicator", err);
      }

      const { processAiAgent } = await import("./ai-agent.server");
      const handledByAi = await processAiAgent(messageBody, phoneDigits, phoneNumberId, userId);
      if (handledByAi) {
        await dbAdmin.from("bot_conversation_state").upsert(
          {
            user_id: userId,
            tenant_id: userId,
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

    logInfo("Executando step do bot", {
      stepId: stepToExecute.id,
      flowId: activeFlow.id,
      messageBody,
    });

    if (stepToExecute.flow_id) {
      await dbAdmin
        .from("bot_flows")
        .update({ last_executed_at: new Date().toISOString() })
        .eq("id", stepToExecute.flow_id)
        .eq("tenant_id", userId);
    }

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
          tenant_id: userId,
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

    if (channel === "whatsapp" || channel === "whatsapp_group") {
      const { data: p } = await dbAdmin
        .from("profiles")
        .select("whatsapp_access_token, meta_graph_version")
        .eq("id", userId)
        .maybeSingle();

      if (!p || !p.whatsapp_access_token) return;

      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: channel === "whatsapp_group" ? "group" : "individual",
        to: phoneDigits,
      };

      if (!stepToExecute.message_type || stepToExecute.message_type === "text") {
        payload.type = "text";
        payload.text = { body: stepToExecute.message_content || "" };
      } else if (["image", "audio", "video", "document"].includes(stepToExecute.message_type)) {
        payload.type = stepToExecute.message_type;
        const mediaObj: any = { link: stepToExecute.media_url || "" };
        if (
          stepToExecute.media_caption &&
          ["image", "video", "document"].includes(stepToExecute.message_type)
        ) {
          mediaObj.caption = stepToExecute.media_caption;
        }
        payload[stepToExecute.message_type] = mediaObj;
      } else if (
        ["buttons", "list"].includes(stepToExecute.message_type) &&
        stepToExecute.buttons_config
      ) {
        try {
          const configObj =
            typeof stepToExecute.buttons_config === "string"
              ? JSON.parse(stepToExecute.buttons_config)
              : stepToExecute.buttons_config;

          payload.type = "interactive";
          if (configObj.interactive) {
            payload.interactive = configObj.interactive;
          } else if (stepToExecute.message_type === "list") {
            payload.interactive = {
              type: "list",
              body: { text: stepToExecute.message_content || "Escolha uma opção" },
              ...(stepToExecute.footer_text
                ? { footer: { text: stepToExecute.footer_text } }
                : {}),
              action: configObj.action || configObj,
            };
          } else {
            payload.interactive = {
              type: "button",
              body: { text: stepToExecute.message_content || "Escolha uma opção" },
              ...(stepToExecute.footer_text
                ? { footer: { text: stepToExecute.footer_text } }
                : {}),
              action: configObj.action || configObj,
            };
          }
        } catch (e: any) {
          logError("Erro ao processar buttons_config", e);
          payload.type = "text";
          payload.text = { body: stepToExecute.message_content || "" };
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
        isSuccess = true;
        const resJson = await r.json();
        providerMsgId = normalizeWaMessageId(resJson?.messages?.[0]?.id) || null;
      } else {
        const errorText = await r.text();
        logError("Meta recusou a mensagem do fluxo", {
          status: r.status,
          stepId: stepToExecute.id,
          messageType: stepToExecute.message_type,
          response: errorText.slice(0, 2000),
        });
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
    } else if (channel === "messenger") {
      const { data: page } = await dbAdmin
        .from("facebook_pages")
        .select("page_access_token")
        .eq("page_id", phoneNumberId)
        .maybeSingle();

      if (!page || !page.page_access_token) {
        logError("Acesso ao Facebook Messenger não configurado ou token expirado");
        return;
      }

      const fbRecipientId = phoneDigits.startsWith("fb_") ? phoneDigits.slice(3) : phoneDigits;
      const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";

      const payload = {
        recipient: { id: fbRecipientId },
        message: { text: stepToExecute.message_content || "" },
      };

      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${page.page_access_token}`,
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
        logError("Erro ao enviar mensagem no Facebook Messenger", errText);
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
        recipient_type: channel === "whatsapp_group" ? "group" : "individual",
        external_group_id: channel === "whatsapp_group" ? phoneDigits : null,
      });
      logInfo("Mensagem enviada pelo bot salva no banco", { providerMsgId });
    }
  } catch (err: any) {
    logError("Exceção fatal no processBotFlow", { error: err.message });
  }
}

export async function executeInactivityStep(
  stepToExecute: any,
  phoneDigits: string,
  phoneNumberId: string,
  userId: string,
  channel: "whatsapp" | "instagram" | "messenger" = "whatsapp",
) {
  if (!phoneNumberId || !phoneDigits || !userId) return;

  try {
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
        const mediaObj: any = { link: stepToExecute.media_url || "" };
        if (
          stepToExecute.media_caption &&
          ["image", "video", "document"].includes(stepToExecute.message_type)
        ) {
          mediaObj.caption = stepToExecute.media_caption;
        }
        payload[stepToExecute.message_type] = mediaObj;
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
    } else if (channel === "messenger") {
      const { data: page } = await dbAdmin
        .from("facebook_pages")
        .select("page_access_token")
        .eq("page_id", phoneNumberId)
        .maybeSingle();

      if (!page || !page.page_access_token) {
        logError("Acesso ao Facebook Messenger não configurado ou token expirado");
        return;
      }

      const fbRecipientId = phoneDigits.startsWith("fb_") ? phoneDigits.slice(3) : phoneDigits;
      const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";

      const payload = {
        recipient: { id: fbRecipientId },
        message: { text: stepToExecute.message_content || "" },
      };

      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${page.page_access_token}`,
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
        logError("Erro ao enviar mensagem no Facebook Messenger", errText);
      }
    }

    if (isSuccess) {
      await dbAdmin.from("bot_conversation_state").upsert(
        {
          user_id: userId,
          tenant_id: userId,
          contact_number: phoneDigits,
          instance_id: phoneNumberId,
          channel,
          current_step_id: stepToExecute.next_step_id || null,
          last_interaction: new Date().toISOString(),
        },
        { onConflict: "user_id,contact_number,instance_id,channel" },
      );

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
          is_inactivity_trigger: true,
        },
      });
      logInfo("Mensagem de inatividade enviada e salva", { providerMsgId });

      if (stepToExecute.flow_id) {
        await dbAdmin
          .from("bot_flows")
          .update({ last_executed_at: new Date().toISOString() })
          .eq("id", stepToExecute.flow_id)
          .eq("tenant_id", userId);
      }
    }
  } catch (err: any) {
    logError("Exceção fatal no executeInactivityStep", { error: err.message });
  }
}

export async function triggerWebhookBotFlow(
  tenantId: string,
  contactId: string,
  payload: Record<string, any>,
) {
  const { default: db } = await import("./db");
  const { matchWebhookPayload } = await import("./webhooks.server");

  try {
    // 1. Busca todos os passos com gatilho de webhook ativos para o tenant
    const activeTriggers = (await db.query(
      `SELECT bs.*, COALESCE(bf.name, b.name) as flow_name, b.channel
       FROM bot_steps bs
       JOIN bot_settings b ON bs.bot_settings_id = b.id
       LEFT JOIN bot_flows bf ON bs.flow_id = bf.id
       WHERE b.user_id = ? AND (b.is_active = 1 OR bf.is_active = 1)
         AND bs.trigger_type = 'webhook'
         AND (bs.flow_id IS NULL OR bf.is_active = 1)`,
      [tenantId],
    )) as any[];

    if (!activeTriggers || activeTriggers.length === 0) return;

    // 2. Obtém dados do contato (telefone)
    const contactRows = (await db.query(
      "SELECT phone_e164 FROM contacts WHERE id = ? LIMIT 1",
      [contactId],
    )) as any[];
    const contact = contactRows?.[0];
    if (!contact || !contact.phone_e164) {
      console.warn("[Webhook Trigger] Contato sem phone_e164, abortando.", { contactId });
      return;
    }

    // 3. Obtém o whatsapp_phone_number_id do perfil do tenant
    const profileRows = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ? LIMIT 1",
      [tenantId],
    )) as any[];
    const profile = profileRows?.[0];
    const phoneNumberId = profile?.whatsapp_phone_number_id;
    if (!phoneNumberId) {
      console.warn("[Webhook Trigger] Tenant sem phoneNumberId, abortando.", { tenantId });
      return;
    }

    for (const trigger of activeTriggers) {
      let conditions: any[] = [];
      try {
        conditions = typeof trigger.trigger_value === "string"
          ? JSON.parse(trigger.trigger_value)
          : trigger.trigger_value || [];
      } catch (e) {
        console.error("[Webhook Trigger] Erro ao parsear condições do trigger:", trigger.id, e);
        continue;
      }

      // 4. Avalia se o payload atende a todas as condições (AND)
      const isMatch = matchWebhookPayload(payload, conditions);

      // 5. Grava log de auditoria
      await db.query(
        `INSERT INTO webhook_bot_logs (tenant_id, flow_id, flow_name, contact_id, is_match, raw_conditions, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          trigger.bot_settings_id,
          trigger.flow_name,
          contactId,
          isMatch ? 1 : 0,
          JSON.stringify(conditions),
          JSON.stringify(payload),
        ],
      );

      // 6. Se deu match, inicia a execução enviando a primeira mensagem (nó de webhook)
      if (isMatch) {
        await executeInactivityStep(
          trigger,
          contact.phone_e164.replace(/\D/g, ""), // apenas dígitos
          phoneNumberId,
          tenantId,
          trigger.channel || "whatsapp",
        );
      }
    }
  } catch (err: any) {
    console.error("[Webhook Trigger] Erro ao processar disparo do fluxo:", err);
  }
}
