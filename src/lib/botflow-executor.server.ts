import { dbAdmin } from "@/integrations/mysql/client.server";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { buildWhatsAppBotMessage } from "@/lib/meta-whatsapp-message";

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
  incomingMessageId?: string | null,
) {
  if (!phoneNumberId || !phoneDigits || !userId || !messageBody) return;

  const { checkLicense } = await import("@/lib/license-verifier");
  const isLicenseValid = await checkLicense(undefined, false);
  if (false && !isLicenseValid) {
    logError("Processamento de fluxo de bot abortado por licença inválida ou ausente.");
    return;
  }

  try {
    // 1. Localizar configurações legadas e fluxos criados pelo construtor.
    // O construtor novo tem bot_flows como fonte de verdade; não dependa de
    // bot_settings para descobrir seus passos, pois essa associação pode estar
    // ausente/inconsistente em instalações antigas de produção.
    let { data: flows } = await dbAdmin
      .from("bot_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", channel);
    flows = flows || [];

    const { data: builderFlows } = await dbAdmin
      .from("bot_flows")
      .select("id, name, channel, is_active, last_executed_at")
      .eq("tenant_id", userId)
      .eq("channel", channel);
    const activeBuilderFlowIds = new Set(
      (builderFlows || []).filter((f: any) => Boolean(f.is_active)).map((f: any) => f.id),
    );
    const activeBuilderFlows = (builderFlows || []).filter((f: any) => Boolean(f.is_active));

    // O status individual do fluxo é a fonte de verdade no construtor novo.
    // bot_settings.is_active continua valendo para fluxos legados, mas não pode
    // bloquear um fluxo que aparece como ativo na tela.
    const hasActiveLegacySettings = flows.some((flow: any) => Boolean(flow.is_active));
    if (!hasActiveLegacySettings && activeBuilderFlowIds.size === 0) {
      logInfo("Nenhum fluxo de bot ativo configurado para o canal", { channel });
      return;
    }

    // Filtrar por instance_id se configurado para evitar compartilhamento indevido
    flows = flows.filter(
      (f: any) => !f.instance_id || String(f.instance_id) === String(phoneNumberId),
    );

    if (flows.length === 0 && activeBuilderFlows.length === 0) {
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
    let activeFlow = sortedFlows[0] || activeBuilderFlows[0];
    let stepToExecute: any = null;

    // Buscar todos os passos ativos do canal
    const builderStepIds = Array.from(activeBuilderFlowIds);
    const legacySettingIds = sortedFlows
      .filter((flow: any) => Boolean(flow.is_active))
      .map((flow: any) => flow.id);
    const { default: db } = await import("./db");
    const builderSteps = builderStepIds.length
      ? ((await db.query(
          `SELECT * FROM bot_steps
           WHERE (user_id = ? OR tenant_id = ?)
             AND flow_id IN (${builderStepIds.map(() => "?").join(",")})
           ORDER BY step_order ASC`,
          [userId, userId, ...builderStepIds],
        )) as any[])
      : [];
    const legacySteps = legacySettingIds.length
      ? ((await db.query(
          `SELECT * FROM bot_steps
           WHERE (user_id = ? OR tenant_id = ?) AND flow_id IS NULL
             AND bot_settings_id IN (${legacySettingIds.map(() => "?").join(",")})
           ORDER BY step_order ASC`,
          [userId, userId, ...legacySettingIds],
        )) as any[])
      : [];

    const stepById = new Map<string, any>();
    for (const step of [...builderSteps, ...legacySteps]) {
      stepById.set(step.id, step);
    }
    const allSteps = Array.from(stepById.values());
    const normalizeTriggerValue = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const matchesConfiguredTrigger = (configured: unknown, received: unknown) => {
      const normalizedReceived = normalizeTriggerValue(received);
      if (!normalizedReceived) return false;
      return String(configured ?? "")
        .split(/[,;\n]/)
        .map(normalizeTriggerValue)
        .filter(Boolean)
        .includes(normalizedReceived);
    };
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
          matchesConfiguredTrigger(s.trigger_value, buttonPayload),
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
            matchesConfiguredTrigger(s.trigger_value, messageBody),
        );

        if (keywordStep) {
          stepToExecute = keywordStep;
          activeFlow = findFlowForStep(keywordStep);
        }

        // Regra 6: Usar fluxo padrão (is_default = true) se nenhum for compatível
        if (!stepToExecute) {
          const defaultFlow = sortedFlows.find((f: any) => f.is_default);
          const startStep = allSteps.find(
            (s: any) => s.flow_id && activeBuilderFlowIds.has(s.flow_id) && s.trigger_type === "start",
          ) || allSteps.find(
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

    // IA só pode ser acionada por uma etapa explícita `link_ai_agent`.
    // Nunca envie "digitando" como mensagem quando o fluxo não tiver etapa.
    if (!stepToExecute) {
      logInfo("Nenhuma etapa aplicável; nenhuma resposta automática enviada.", { messageBody, channel });
      return;
    }

    if (stepToExecute.flow_id) {
      await dbAdmin
        .from("bot_flows")
        .update({ last_executed_at: new Date().toISOString() })
        .eq("id", stepToExecute.flow_id)
        .eq("tenant_id", userId);
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

    // "Vincular Agente IA" é uma ação interna do construtor, não um tipo de
    // mensagem da Cloud API. Executamos a IA antes de montar um payload Meta.
    if (stepToExecute.message_type === "link_ai_agent" && channel === "whatsapp") {
      const { processAiAgent } = await import("./ai-agent.server");
      const handledByAi = await processAiAgent(messageBody, phoneDigits, phoneNumberId, userId);
      if (handledByAi) {
        await commitState();
        logInfo("Resposta gerada pelo agente IA", { stepId: stepToExecute.id });
        return;
      }
      logError("Agente IA não respondeu; usando mensagem de contingência", { stepId: stepToExecute.id });
    }

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

      const { payload, fallbackReason } = buildWhatsAppBotMessage(
        phoneDigits,
        stepToExecute,
        channel === "whatsapp" ? incomingMessageId : null,
      );
      if (channel === "whatsapp_group") payload.recipient_type = "group";
      if (fallbackReason) logInfo("Etapa convertida para payload compatível", { stepId: stepToExecute.id, fallbackReason });

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
        tenant_id: userId,
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

      const { payload, fallbackReason } = buildWhatsAppBotMessage(phoneDigits, stepToExecute);
      if (fallbackReason) logInfo("Etapa de inatividade convertida para payload compatível", { stepId: stepToExecute.id, fallbackReason });

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
        tenant_id: userId,
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
/*

export async function triggerWebhookBotFlow(
  tenantId: string,
  contactId: string,
  payload: Record<string, any>,
    }
  } catch (err: any) {
    logError("Exceção fatal no executeInactivityStep", { error: err.message });
  }
}

*/

export async function triggerWebhookBotFlow(
  tenantId: string,
  contactId: string,
  payload: Record<string, any>,
) {
  const { default: db } = await import("./db");
  const { matchWebhookPayload } = await import("./webhooks.server");

  try {
    const activeTriggers = (await db.query(
      `SELECT bs.*, COALESCE(bf.name, b.name, 'Fluxo sem nome') AS flow_name,
              COALESCE(bf.channel, b.channel, 'whatsapp') AS channel
       FROM bot_steps bs
       LEFT JOIN bot_settings b
         ON CONVERT(b.id USING utf8mb4) COLLATE utf8mb4_unicode_ci =
            CONVERT(bs.bot_settings_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
       LEFT JOIN bot_flows bf
         ON CONVERT(bf.id USING utf8mb4) COLLATE utf8mb4_unicode_ci =
            CONVERT(bs.flow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
       WHERE (bs.user_id = ? OR bs.tenant_id = ?)
         AND bs.trigger_type = 'webhook'
         AND ((bs.flow_id IS NOT NULL AND bf.is_active = true)
           OR (bs.flow_id IS NULL AND b.is_active = true))`,
      [tenantId, tenantId],
    )) as any[];
    if (activeTriggers.length === 0) return;

    const contactRows = (await db.query(
      "SELECT phone_e164 FROM contacts WHERE id = ? AND (user_id = ? OR tenant_id = ?) LIMIT 1",
      [contactId, tenantId, tenantId],
    )) as Array<{ phone_e164?: string | null }>;
    const contact = contactRows[0];
    if (!contact?.phone_e164) return;

    const profileRows = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ? LIMIT 1",
      [tenantId],
    )) as Array<{ whatsapp_phone_number_id?: string | null }>;
    const phoneNumberId = profileRows[0]?.whatsapp_phone_number_id;
    if (!phoneNumberId) return;

    for (const trigger of activeTriggers) {
      let conditions: unknown = [];
      try {
        conditions = typeof trigger.trigger_value === "string"
          ? JSON.parse(trigger.trigger_value)
          : trigger.trigger_value || [];
      } catch {
        continue;
      }
      const isMatch = matchWebhookPayload(payload, Array.isArray(conditions) ? conditions : []);
      await db.query(
        `INSERT INTO webhook_bot_logs (id, tenant_id, flow_id, flow_name, contact_id, is_match, raw_conditions, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), tenantId, trigger.flow_id || trigger.bot_settings_id, trigger.flow_name, contactId, isMatch ? 1 : 0, JSON.stringify(conditions), JSON.stringify(payload)],
      );
      if (isMatch) {
        await executeInactivityStep(trigger, contact.phone_e164.replace(/\D/g, ""), phoneNumberId, tenantId, trigger.channel || "whatsapp");
      }
    }
  } catch (err: any) {
    logError("Falha ao disparar fluxo por webhook", { error: err?.message });
  }
}

/*
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
      `SELECT bs.*, COALESCE(bf.name, b.name) as flow_name, COALESCE(bf.channel, b.channel, 'whatsapp') as channel
       FROM bot_steps bs
       LEFT JOIN bot_settings b ON bs.bot_settings_id = b.id
       LEFT JOIN bot_flows bf ON bs.flow_id = bf.id
       WHERE (bs.user_id = ? OR bs.tenant_id = ?)
         AND bs.trigger_type = 'webhook'
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
*/
