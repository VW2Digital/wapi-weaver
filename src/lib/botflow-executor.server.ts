import fs from "fs";
import path from "path";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { transcodeAudioToMp3 } from "@/lib/audio-transcode.server";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { buildWhatsAppBotMessage } from "@/lib/meta-whatsapp-message";
import { getBotActivationContext, evaluateBotActivation } from "@/lib/messaging/services/bot-lifecycle.service";

function logInfo(message: string, data?: any) {
  console.log(`[botflow] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[botflow] ${message}`, data ? JSON.stringify(data) : "");
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/opus": "opus",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

async function uploadBufferToMeta(
  binaryBuffer: Buffer,
  mimeType: string,
  uploadFilename: string,
  phoneNumberId: string,
  accessToken: string,
  apiVersion: string,
): Promise<string | null> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([new Uint8Array(binaryBuffer)], { type: mimeType }), uploadFilename);

  const uploadRes = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  if (uploadRes.ok) {
    const uploadJson = await uploadRes.json();
    return uploadJson?.id || null;
  } else {
    const errText = await uploadRes.text();
    logError("Falha no upload de mídia para a Meta", {
      status: uploadRes.status,
      mimeType,
      uploadFilename,
      response: errText.slice(0, 800),
    });
    return null;
  }
}

async function prepareStepMediaForMeta(
  stepToExecute: any,
  phoneNumberId: string,
  accessToken: string,
  apiVersion: string,
): Promise<{ ok: true; step: any } | { ok: false; code: string; message: string }> {
  const rawMediaUrl = String(stepToExecute.media_url || "").trim();
  const isAudioStep = String(stepToExecute.message_type || "").toLowerCase() === "audio";
  if (!rawMediaUrl) return { ok: true, step: stepToExecute };

  // Se já for um ID numérico da Meta (ex: "1234567890"), mantém diretamente
  if (/^\d{10,25}$/.test(rawMediaUrl)) {
    return { ok: true, step: stepToExecute };
  }

  // 1. data:URL (base64)
  if (rawMediaUrl.startsWith("data:")) {
    try {
      const commaIdx = rawMediaUrl.indexOf(",");
      if (commaIdx === -1) throw new Error("data:URL inválida — sem separador de conteúdo");

      const header = rawMediaUrl.slice(0, commaIdx);
      const base64Data = rawMediaUrl.slice(commaIdx + 1);
      let mimeType = header.replace(/^data:/, "").replace(/;base64$/i, "").trim();
      let ext = MIME_EXT[mimeType] || mimeType.split("/").pop()?.split(";")[0] || "bin";
      let uploadFilename = `document.${ext}`;
      let binaryBuffer = Buffer.from(base64Data, "base64");
      if (isAudioStep) {
        binaryBuffer = Buffer.from(await transcodeAudioToMp3(binaryBuffer));
        mimeType = "audio/mpeg";
        ext = "mp3";
        uploadFilename = "audio.mp3";
      }

      const mediaId = await uploadBufferToMeta(
        binaryBuffer,
        mimeType,
        uploadFilename,
        phoneNumberId,
        accessToken,
        apiVersion,
      );
      if (mediaId) {
        return { ok: true, step: { ...stepToExecute, media_url: mediaId, original_filename: uploadFilename } };
      }
    } catch (err: any) {
      logError("Exceção ao processar data:URL de mídia para a Meta", { error: err.message });
    }
  }

  // 2. Arquivo no disco local (uploads/..., /uploads/..., /api/storage/file?path=..., etc.)
  let cleanLocalPath: string | null = null;

  if (rawMediaUrl.includes("/api/storage/file") || rawMediaUrl.includes("/api/storage/global-file")) {
    try {
      const urlObj = new URL(rawMediaUrl, "http://localhost");
      cleanLocalPath = urlObj.searchParams.get("path");
    } catch {
      cleanLocalPath = null;
    }
  } else if (
    rawMediaUrl.startsWith("uploads/") ||
    rawMediaUrl.startsWith("/uploads/") ||
    rawMediaUrl.startsWith("public/uploads/") ||
    rawMediaUrl.startsWith("/public/uploads/")
  ) {
    cleanLocalPath = rawMediaUrl.replace(/^\/?(public\/)?uploads\//, "");
  } else if (!rawMediaUrl.startsWith("http://") && !rawMediaUrl.startsWith("https://")) {
    cleanLocalPath = rawMediaUrl.replace(/^\/+/, "");
  } else if (rawMediaUrl.startsWith("http://localhost") || rawMediaUrl.startsWith("http://127.0.0.1")) {
    try {
      const urlObj = new URL(rawMediaUrl);
      if (urlObj.pathname.includes("/api/storage/file") || urlObj.pathname.includes("/api/storage/global-file")) {
        cleanLocalPath = urlObj.searchParams.get("path");
      } else {
        cleanLocalPath = urlObj.pathname.replace(/^\/?(public\/)?(uploads\/)?/, "");
      }
    } catch {
      cleanLocalPath = null;
    }
  }

  if (cleanLocalPath) {
    try {
      const decodedPath = decodeURIComponent(cleanLocalPath).trim().replace(/\\/g, "/").replace(/^\/+/, "");
      const possibleLocations = [
        path.resolve(process.cwd(), "public", "uploads", decodedPath),
        path.resolve(process.cwd(), "public", decodedPath),
        path.resolve(process.cwd(), decodedPath),
      ];

      let foundPath: string | null = null;
      for (const loc of possibleLocations) {
        if (fs.existsSync(loc) && fs.statSync(loc).isFile()) {
          foundPath = loc;
          break;
        }
      }

      if (foundPath) {
        let binaryBuffer = fs.readFileSync(foundPath);
        let ext = path.extname(foundPath).toLowerCase().replace(/^\./, "") || "pdf";
        let mimeType = EXT_MIME[ext] || "application/octet-stream";
        let uploadFilename = path.basename(foundPath) || `document.${ext}`;
        if (isAudioStep) {
          binaryBuffer = Buffer.from(await transcodeAudioToMp3(binaryBuffer));
          ext = "mp3";
          mimeType = "audio/mpeg";
          uploadFilename = `${path.parse(uploadFilename).name || "audio"}.mp3`;
        }

        const mediaId = await uploadBufferToMeta(
          binaryBuffer,
          mimeType,
          uploadFilename,
          phoneNumberId,
          accessToken,
          apiVersion,
        );

        if (mediaId) {
          logInfo("Arquivo local do bot enviado com sucesso para a Meta", {
            stepId: stepToExecute.id,
            mediaId,
            foundPath,
            uploadFilename,
          });
          return { ok: true, step: { ...stepToExecute, media_url: mediaId, original_filename: uploadFilename } };
        }
      } else {
        logError("Arquivo local do bot não encontrado no disco", {
          rawMediaUrl,
          cleanLocalPath,
          possibleLocations,
        });
      }
    } catch (err: any) {
      logError("Exceção ao resolver arquivo local para a Meta", { error: err.message });
    }
  }

  // Arquivo local, data URL ou localhost nunca pode chegar ao endpoint Meta
  // como URL pública. O passo falha fechado para evitar envio inválido.
  if (rawMediaUrl.startsWith("data:") || cleanLocalPath || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(rawMediaUrl)) {
    return { ok: false, code: "BOTFLOW_MEDIA_PREPARATION_FAILED", message: "Não foi possível enviar a mídia local para a Meta." };
  }
  return { ok: true, step: stepToExecute };
}

export async function processBotFlow(
  messageBody: string,
  phoneDigits: string,
  phoneNumberId: string,
  userId: string,
  buttonPayload?: string,
  channel: "whatsapp" | "instagram" | "messenger" | "whatsapp_group" | "webchat" = "whatsapp",
  incomingMessageId?: string | null,
) {
  if (!phoneNumberId || !phoneDigits || !userId || (!messageBody && !buttonPayload)) return;

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

    const { default: db } = await import("./db");
    const builderFlows: any[] = (await db.query(
      `SELECT id, name, channel, is_active, last_executed_at FROM bot_flows WHERE (tenant_id = ? OR user_id = ?) AND channel = ?`,
      [userId, userId, channel],
    )) as any[];
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
    // O estado de uma conversa pertence ao número conectado. Sem filtrar por
    // instance_id, uma pausa/desativação deixada por uma conexão anterior pode
    // bloquear o bot de um número reconectado (ou de outra instância do mesmo
    // tenant).
    const { data: stateForCurrentInstance } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .eq("channel", channel)
      .eq("instance_id", phoneNumberId)
      .maybeSingle();

    // Estados legados não tinham instance_id. Eles seguem válidos somente
    // quando não houver um estado explícito para o número atual.
    const { data: legacyState } = stateForCurrentInstance
      ? { data: null }
      : await dbAdmin
          .from("bot_conversation_state")
          .select("*")
          .eq("user_id", userId)
          .eq("contact_number", phoneDigits)
          .eq("channel", channel)
          .is("instance_id", null)
          .maybeSingle();
    const state = stateForCurrentInstance ?? legacyState;

    // A ativação/pausa feita no chat vale para o contato, independentemente
    // da instância usada para guardar o progresso do fluxo. Durante migrações
    // podem coexistir uma linha legada e outra ligada ao phone_number_id; nesse
    // caso, a alteração manual mais recente é a fonte de verdade.
    const { data: controlState } = await dbAdmin
      .from("bot_conversation_state")
      .select("id, bot_active, is_paused, paused_until")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .eq("channel", channel)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const effectiveControlState = controlState ?? state;

    if (effectiveControlState && !effectiveControlState.bot_active) {
      logInfo("Bot desativado manualmente para este contato", { phoneDigits });
      return;
    }

    if (effectiveControlState && effectiveControlState.is_paused) {
      const rawPaused = effectiveControlState.paused_until;
      let pausedUntil = new Date(0);
      if (rawPaused) {
        const str = typeof rawPaused === "string" ? rawPaused : new Date(rawPaused).toISOString();
        pausedUntil = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
      }

      if (Date.now() < pausedUntil.getTime()) {
        logInfo("Bot pausado para este contato", { phoneDigits, pausedUntil });
        return;
      } else {
        logInfo("Pausa do bot expirou, retomando...", { phoneDigits });
        await dbAdmin
          .from("bot_conversation_state")
          .update({ is_paused: false, paused_until: null })
          .eq("id", effectiveControlState.id);
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
      const configuredTriggers = String(configured ?? "")
        .split(/[,;\n]/)
        .map(normalizeTriggerValue)
        .filter(Boolean);
      return configuredTriggers.some(
        (trigger) =>
          normalizedReceived === trigger ||
          normalizedReceived.startsWith(`${trigger} `) ||
          normalizedReceived.endsWith(` ${trigger}`) ||
          normalizedReceived.includes(` ${trigger} `) ||
          (trigger.length >= 3 && normalizedReceived.includes(trigger)),
      );
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
        logInfo("[BOT] Handoff manual acionado por botão interativo.");
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
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        buttonPayload,
      );

      // Caso 1: botão configurado como gatilho (trigger_type = button + trigger_value match)
      // ou o próprio id do step foi colocado como buttonPayload (legado sem prefixo step:)
      const buttonStep = allSteps.find(
        (s: any) =>
          (s.trigger_type === "button" && matchesConfiguredTrigger(s.trigger_value, buttonPayload)),
      );

      if (buttonStep) {
        stepToExecute = buttonStep;
        activeFlow = findFlowForStep(buttonStep);
        isButtonRedirect = true;
      } else if (isUUID) {
        // Caso 2: buttonPayload é um UUID puro → é o ID do step destino
        // (item de lista/botão salvo antes da migração para o prefixo "step:")
        const targetStep = allSteps.find((s: any) => s.id === buttonPayload);
        if (targetStep) {
          stepToExecute = targetStep;
          activeFlow = findFlowForStep(targetStep);
          isButtonRedirect = true;
          logInfo("[BOTFLOW] Roteamento por UUID puro (sem prefixo step:)", { buttonPayload, stepId: targetStep.id });
        }
      }
    }

    if (!isButtonRedirect) {
      // Regra 1: Se existe sessão ativa para a conversa (e não é comando global de interrupção nem está expirada), continuar o fluxo atual
      if (state && state.current_step_id && !isSessionExpired && !isInterruption) {
        const queuedStep = allSteps?.find((s: any) => s.id === state.current_step_id);
        if (queuedStep) {
          stepToExecute = queuedStep;
          activeFlow = findFlowForStep(queuedStep);
          logInfo("[BOTFLOW] Continuando fluxo na etapa seguinte", { stepId: queuedStep.id });
        }
      }

      // Regra 2: Processar interrupção global
      if (!stepToExecute) {
        if (isInterruption) {
          logInfo("[BOT] Interrupção global do bot solicitada pelo usuário", { messageBody });

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
            logInfo("[BOT] Handoff manual acionado por palavra-chave global.");
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
          logInfo("[BOTFLOW] Gatilho de palavra-chave correspondido", { stepId: keywordStep.id, triggerValue: keywordStep.trigger_value });
        }

        // Regra 6: Usar gatilho de primeira mensagem, início (start) ou primeiro passo do fluxo ativo
        if (!stepToExecute) {
          const defaultFlow = sortedFlows.find((f: any) => f.is_default);

          // 6.1: Gatilho explícito de primeira mensagem
          const firstMessageStep =
            allSteps.find(
              (s: any) =>
                s.flow_id &&
                activeBuilderFlowIds.has(s.flow_id) &&
                s.trigger_type === "first_message",
            ) || allSteps.find((s: any) => s.trigger_type === "first_message");

          // 6.2: Gatilho de início (start)
          const startStep =
            allSteps.find(
              (s: any) =>
                s.flow_id &&
                activeBuilderFlowIds.has(s.flow_id) &&
                s.trigger_type === "start",
            ) ||
            allSteps.find(
              (s: any) =>
                s.trigger_type === "start" &&
                (!defaultFlow || s.bot_settings_id === defaultFlow.id),
            ) ||
            allSteps.find((s: any) => s.trigger_type === "start");

          // 6.3: Fallback para o primeiro passo ordenado do fluxo ativo
          const rootStep =
            (activeBuilderFlowIds.size > 0
              ? allSteps.find(
                  (s: any) =>
                    s.flow_id &&
                    activeBuilderFlowIds.has(s.flow_id) &&
                    Number(s.step_order) === 1,
                )
              : null) ||
            allSteps.find((s: any) => Number(s.step_order) === 1) ||
            allSteps[0];

          const resolvedStartStep = firstMessageStep || startStep || rootStep;
          if (resolvedStartStep) {
            stepToExecute = resolvedStartStep;
            activeFlow = findFlowForStep(resolvedStartStep);
            logInfo("[BOTFLOW] Etapa inicial selecionada para conversa", {
              stepId: resolvedStartStep.id,
              triggerType: resolvedStartStep.trigger_type,
              flowId: activeFlow?.id,
            });
          }
        }
      }
    }

    // Se o passo inicial for um nó puramente de gatilho/roteamento sem conteúdo real de envio, avança para o próximo passo do fluxo
    if (
      stepToExecute &&
      stepToExecute.next_step_id &&
      (!stepToExecute.message_content ||
        stepToExecute.message_content.startsWith("Gatilho:") ||
        ["start", "first_message", "trigger"].includes(stepToExecute.message_type))
    ) {
      const nextTarget = allSteps.find((s: any) => s.id === stepToExecute.next_step_id);
      if (nextTarget) {
        logInfo("[BOTFLOW] Avançando de nó gatilho para nó de conteúdo", {
          triggerStepId: stepToExecute.id,
          targetStepId: nextTarget.id,
        });
        stepToExecute = nextTarget;
        activeFlow = findFlowForStep(nextTarget);
      }
    }

    // 3.5. LOOP DE EXECUÇÃO DE NÓS DE CONTROLE (Control Nodes)
    // Delay, Condition, Randomizer, Save Variable, HTTP Request
    // Control nodes NÃO são enviados como mensagens para o provedor (Meta/WhatsApp).
    // Eles executam internamente e roteiam o fluxo até o próximo nó de mensagem ou fim do fluxo.
    const {
      resolveTemplate,
      evaluateCondition,
      evaluateRandomizer,
      executeHttpRequest,
      executeSaveVariable,
    } = await import("./botflow-control");

    // Carrega dados do contato para contexto de resolução de variáveis
    let contactRecord: any = null;
    try {
      const { default: db } = await import("./db");
      const cRows = (await db.query(
        "SELECT * FROM contacts WHERE (user_id = ? OR tenant_id = ?) AND (phone_e164 LIKE ? OR phone_e164 LIKE ?) LIMIT 1",
        [userId, userId, `%${phoneDigits}%`, `%${phoneDigits.slice(-8)}%`],
      )) as any[];
      contactRecord = cRows?.[0] || null;
    } catch {
      contactRecord = null;
    }

    let parsedCustomFields: Record<string, any> = {};
    try {
      if (contactRecord?.custom_fields) {
        parsedCustomFields =
          typeof contactRecord.custom_fields === "string"
            ? JSON.parse(contactRecord.custom_fields)
            : contactRecord.custom_fields || {};
      }
    } catch {
      parsedCustomFields = {};
    }

    const executionContext: any = {
      tenantId: userId,
      userId,
      contact: {
        id: contactRecord?.id,
        phone: phoneDigits,
        name: contactRecord?.name || "",
        email: contactRecord?.email || "",
        company: contactRecord?.company || "",
        notes: contactRecord?.notes || "",
        customFields: parsedCustomFields,
      },
      message: {
        text: messageBody,
        buttonPayload,
        type: "text",
      },
      channel,
      flowId: stepToExecute?.flow_id || activeFlow?.id,
      stepId: stepToExecute?.id,
      variables: {},
      httpResponse: null,
    };

    const CONTROL_TYPES = new Set(["delay", "condition", "randomizer", "save_variable", "http_request"]);
    const MAX_CONTROL_HOPS = 50;
    let hops = 0;

    while (stepToExecute && CONTROL_TYPES.has(stepToExecute.message_type)) {
      hops++;
      if (hops > MAX_CONTROL_HOPS) {
        logError("Limite máximo de 50 hops de controle atingido. Possível loop infinito.", {
          stepId: stepToExecute.id,
          flowId: activeFlow?.id,
        });
        break;
      }

      logInfo(`Executando nó de controle (#${hops}): ${stepToExecute.message_type}`, {
        stepId: stepToExecute.id,
      });

      let stepConfig: any = {};
      try {
        stepConfig =
          typeof stepToExecute.buttons_config === "string"
            ? JSON.parse(stepToExecute.buttons_config || "{}")
            : stepToExecute.buttons_config || {};
      } catch {
        stepConfig = {};
      }
      const ctrl = stepConfig.control || stepConfig;

      if (stepToExecute.message_type === "delay") {
        // Bloco Delay: aguarda N segundos/minutos/horas de forma durável
        const duration = Number(ctrl.duration) || Number(stepToExecute.delay_seconds) || 5;
        const unit = ctrl.unit || "seconds";
        const delaySec = unit === "hours" ? duration * 3600 : unit === "minutes" ? duration * 60 : duration;
        const nextStepId = stepToExecute.next_step_id || ctrl.nextStepId || null;

        logInfo(`[BOTFLOW] Nó Delay pausando fluxo por ${delaySec}s`, { stepId: stepToExecute.id, nextStepId });

        if (delaySec <= 10 && nextStepId) {
          // Delay curto (<= 10s): aguarda localmente no servidor
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
          stepToExecute = allSteps.find((s: any) => s.id === nextStepId) || null;
          continue;
        } else {
          // Delay longo: agenda estado para retomada
          await dbAdmin.from("bot_conversation_state").upsert(
            {
              user_id: userId,
              tenant_id: userId,
              contact_number: phoneDigits,
              instance_id: phoneNumberId,
              channel,
              bot_active: 1,
              is_paused: 1,
              current_step_id: stepToExecute.id,
              last_interaction: new Date().toISOString(),
              paused_until: new Date(Date.now() + delaySec * 1000).toISOString(),
            },
            { onConflict: "user_id,contact_number,instance_id,channel" },
          );
          return;
        }
      } else if (stepToExecute.message_type === "condition") {
        const isTrue = evaluateCondition(ctrl, executionContext);
        const targetStepId = isTrue ? ctrl.trueStepId : ctrl.falseStepId;
        logInfo(`[BOTFLOW] Nó Condition avaliado como ${isTrue ? "VERDADEIRO" : "FALSO"} -> destino: ${targetStepId}`);
        stepToExecute = targetStepId ? allSteps.find((s: any) => s.id === targetStepId) || null : null;
      } else if (stepToExecute.message_type === "randomizer") {
        executionContext.stepId = stepToExecute.id;
        const result = evaluateRandomizer(ctrl, executionContext);
        logInfo(`[BOTFLOW] Nó Randomizer selecionou branch ${result.branchId} -> destino: ${result.nextStepId}`);
        stepToExecute = result.nextStepId ? allSteps.find((s: any) => s.id === result.nextStepId) || null : null;
      } else if (stepToExecute.message_type === "save_variable") {
        const { default: db } = await import("./db");
        const result = await executeSaveVariable(ctrl, executionContext, db);
        const targetStepId = result.nextStepId || stepToExecute.next_step_id;
        logInfo(`[BOTFLOW] Nó Save Variable persistiu ${ctrl.key} -> destino: ${targetStepId}`);
        stepToExecute = targetStepId ? allSteps.find((s: any) => s.id === targetStepId) || null : null;
      } else if (stepToExecute.message_type === "http_request") {
        const httpRes = await executeHttpRequest(ctrl, executionContext);
        logInfo(`[BOTFLOW] Nó HTTP Request ${httpRes.success ? "SUCESSO" : "ERRO"} (status ${httpRes.status}) -> destino: ${httpRes.nextStepId}`);
        stepToExecute = httpRes.nextStepId ? allSteps.find((s: any) => s.id === httpRes.nextStepId) || null : null;
      }
    }

    if (!stepToExecute) {
      logInfo("[BOTFLOW] Fluxo finalizado ou nenhuma etapa aplicável.", { channel });
      return;
    }

    // Resolve variáveis dinâmicas no texto da mensagem do próximo passo
    if (stepToExecute.message_content) {
      stepToExecute.message_content = resolveTemplate(stepToExecute.message_content, executionContext);
    }
    if (stepToExecute.media_caption) {
      stepToExecute.media_caption = resolveTemplate(stepToExecute.media_caption, executionContext);
    }

    if (stepToExecute.flow_id) {
      await dbAdmin
        .from("bot_flows")
        .update({ last_executed_at: new Date().toISOString() })
        .eq("id", stepToExecute.flow_id)
        .eq("tenant_id", userId);
    }

    logInfo("[BOTFLOW] Executando step do bot", {
      stepId: stepToExecute.id,
      flowId: activeFlow?.id,
      messageType: stepToExecute.message_type,
      messageBody,
    });

    const isHandoff = stepToExecute.next_step_id === "-999" || stepToExecute.message_type === "transfer_chat";
    let handoffPauseMinutes = 24 * 60;
    if (stepToExecute.message_type === "transfer_chat") {
      try {
        const handoffConfig = typeof stepToExecute.buttons_config === "string"
          ? JSON.parse(stepToExecute.buttons_config || "{}")
          : stepToExecute.buttons_config || {};
        const configuredMinutes = Number(handoffConfig?.action?.pause_minutes);
        if (Number.isFinite(configuredMinutes) && configuredMinutes >= 1 && configuredMinutes <= 10080) handoffPauseMinutes = configuredMinutes;
      } catch {
        // Política padrão de 24h permanece quando a configuração estiver inválida.
      }
    }
    const updateData = {
      current_step_id: isHandoff ? null : stepToExecute.next_step_id || null,
      last_interaction: new Date().toISOString(),
      ...(isHandoff
        ? {
            is_paused: true,
            paused_until: new Date(Date.now() + handoffPauseMinutes * 60 * 1000).toISOString(),
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
          bot_active: 1,
          is_paused: isHandoff ? 1 : 0,
          ...updateData,
        },
        { onConflict: "user_id,contact_number,instance_id,channel" },
      );
    };

    // Handoff é uma ação interna: pausa o bot e só envia confirmação quando
    // ela foi configurada. Nunca envia `type=transfer_chat` para a Meta.
    if (stepToExecute.message_type === "transfer_chat") {
      try {
        // Reutiliza a mesma tabela de atribuição usada pelo roteamento de botões.
        await dbAdmin
          .from("conversation_assignments")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("contact_phone", phoneDigits)
          .eq("is_active", true);
        const { randomUUID } = await import("crypto");
        await dbAdmin.from("conversation_assignments").insert({
          id: randomUUID(),
          user_id: userId,
          contact_phone: phoneDigits,
          team_id: stepToExecute.assign_team_id || null,
          agent_id: stepToExecute.assign_user_id || null,
          assigned_by: null,
          is_active: true,
        });
      } catch (error: any) {
        logError("Falha ao atribuir conversa durante handoff", { stepId: stepToExecute.id, error: error?.message });
        return;
      }
      const confirmation = String(stepToExecute.handoff_message || stepToExecute.message_content || "").trim();
      if (!confirmation) {
        await commitState();
        logInfo("[BOT] Handoff executado sem mensagem de confirmação", { stepId: stepToExecute.id });
        return;
      }
      stepToExecute = { ...stepToExecute, message_type: "text", message_content: confirmation };
    }

    // "Vincular Agente IA" é uma ação interna do construtor, não um tipo de
    // mensagem da Cloud API. Executamos a IA antes de montar um payload Meta.
    if (stepToExecute.message_type === "link_ai_agent" && channel === "whatsapp") {
      const preAiDecision = await evaluateBotActivation(
        await getBotActivationContext(userId, channel, phoneDigits),
      );
      if (!preAiDecision.active) {
        logInfo("[BOT] Execução abortada antes da IA", { reason: preAiDecision.reason, phoneDigits, stepId: stepToExecute.id });
        return;
      }
      const { processAiAgent } = await import("./ai-agent.server");
      const handledByAi = await processAiAgent(messageBody, phoneDigits, phoneNumberId, userId);
      if (handledByAi) {
        await commitState();
        logInfo("[BOT] Resposta gerada pelo agente IA", { stepId: stepToExecute.id });
        return;
      }
      let fallbackText = "";
      try {
        const cfg = typeof stepToExecute.buttons_config === "string"
          ? JSON.parse(stepToExecute.buttons_config || "{}")
          : stepToExecute.buttons_config || {};
        fallbackText = String(cfg?.action?.fallback_text || "").trim();
      } catch {
        fallbackText = "";
      }
      if (!fallbackText) {
        logError("[BOT] Agente IA não respondeu e não há mensagem de contingência", { stepId: stepToExecute.id });
        return;
      }
      // Contingência é uma mensagem de texto válida; a ação interna nunca é
      // enviada como type=link_ai_agent para a Meta.
      stepToExecute = { ...stepToExecute, message_type: "text", message_content: fallbackText };
      logError("[BOT] Agente IA não respondeu; enviando contingência configurada", { stepId: stepToExecute.id });
    }

    // 4. Disparar o envio da mensagem para o canal correto
    const preSendDecision = await evaluateBotActivation(
      await getBotActivationContext(userId, channel, phoneDigits),
    );
    if (!preSendDecision.active) {
      logInfo("[BOT] Envio abortado por desativação/pausa durante execução", { reason: preSendDecision.reason, phoneDigits, stepId: stepToExecute.id });
      return;
    }

    let isSuccess = false;
    let providerMsgId: string | null = null;
    let sentPayload: Record<string, unknown> | null = null;
    let messageBuildMeta: Record<string, unknown> | null = null;

    if (channel === "whatsapp" || channel === "whatsapp_group") {
      const { data: p } = await dbAdmin
        .from("profiles")
        .select("whatsapp_access_token, meta_graph_version")
        .eq("id", userId)
        .maybeSingle();

      const accessToken = p?.whatsapp_access_token || process.env.META_ACCESS_TOKEN;
      if (!accessToken) {
        logError("Token de acesso do WhatsApp (whatsapp_access_token) não encontrado no perfil ou env", { userId });
        return;
      }

      const apiVersion = p?.meta_graph_version || process.env.META_GRAPH_VERSION || "v26.0";
      const preparedMedia = await prepareStepMediaForMeta(
        stepToExecute,
        phoneNumberId,
        accessToken,
        apiVersion,
      );

      if (!preparedMedia.ok) {
        logError("BOTFLOW_MEDIA_PREPARATION_FAILED", { flowId: stepToExecute.flow_id, stepId: stepToExecute.id, reason: preparedMedia.message });
        return;
      }
      const build = buildWhatsAppBotMessage(
        phoneDigits,
        preparedMedia.step,
        channel === "whatsapp" ? incomingMessageId : null,
      );
      if (!build.ok) {
        logError(build.code, { flowId: stepToExecute.flow_id, stepId: stepToExecute.id, messageType: stepToExecute.message_type, reason: build.message });
        return;
      }
      const { payload } = build;
      sentPayload = payload;
      messageBuildMeta = build.meta;
      if (channel === "whatsapp_group") payload.recipient_type = "group";
      logInfo("Enviando mensagem WhatsApp do fluxo", { flowId: stepToExecute.flow_id, stepId: stepToExecute.id, botflowType: build.meta.botflowType, metaType: build.meta.metaType, interactiveType: build.meta.interactiveType, recipient: `${phoneDigits.slice(0, 4)}***${phoneDigits.slice(-2)}` });

      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
          response: errorText.slice(0, 1000),
        });
      }
    } else if (channel === "instagram") {
      const { data: igAcc } = await dbAdmin
        .from("instagram_accounts")
        .select("access_token")
        .eq("instagram_business_account_id", phoneNumberId)
        .maybeSingle();

      if (!igAcc || !igAcc.access_token) {
        logError("Acesso ao Instagram não configurado ou token expirado");
        return;
      }

      const igRecipientId = phoneDigits.startsWith("ig_") ? phoneDigits.slice(3) : phoneDigits;
      const apiVersion = process.env.META_GRAPH_VERSION || "v26.0";

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
      const apiVersion = process.env.META_GRAPH_API_VERSION || "v26.0";

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
    } else if (channel === "webchat") {
      isSuccess = true;
      providerMsgId = crypto.randomUUID();
      logInfo("[BOT] WebChat bot response recorded", { stepId: stepToExecute.id, providerMsgId });
    }

    if (isSuccess) {
      await commitState();

      const msgType = ["image", "video", "audio", "document", "sticker", "location"].includes(
        stepToExecute.message_type,
      )
        ? stepToExecute.message_type
        : "text";
      const msgBody =
        stepToExecute.message_content ||
        stepToExecute.media_caption ||
        (stepToExecute.message_type === "document" ? "Documento enviado pelo bot" : "");

      await dbAdmin.from("direct_messages").insert({
        tenant_id: userId,
        user_id: userId,
        contact_phone: phoneDigits,
        direction: "outgoing",
        type: msgType,
        body: msgBody,
        channel,
        provider_message_id: providerMsgId,
        provider_account_id: phoneNumberId,
        status: "sent",
        metadata: {
          step_id: stepToExecute.id,
          bot_triggered: true,
          payload: sentPayload,
          message_build: messageBuildMeta,
          media_url: stepToExecute.media_url,
          filename: stepToExecute.media_caption || "document.pdf",
          caption: stepToExecute.media_caption || stepToExecute.message_content,
        },
        recipient_type: channel === "whatsapp_group" ? "group" : "individual",
        external_group_id: channel === "whatsapp_group" ? phoneDigits : null,
      });
      logInfo("Mensagem enviada pelo bot salva no banco", { providerMsgId, msgType });
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
  channel: "whatsapp" | "instagram" | "messenger" | "webchat" = "whatsapp",
) {
  if (!phoneNumberId || !phoneDigits || !userId || !stepToExecute) return;

  try {
    const { default: db } = await import("./db");
    const {
      resolveTemplate,
      evaluateCondition,
      evaluateRandomizer,
      executeHttpRequest,
      executeSaveVariable,
    } = await import("./botflow-control");

    // Carrega passos do fluxo se necessário para navegar nós de controle
    let allSteps: any[] = [];
    if (stepToExecute.flow_id) {
      allSteps = (await db.query(
        "SELECT * FROM bot_steps WHERE flow_id = ? AND (user_id = ? OR tenant_id = ?)",
        [stepToExecute.flow_id, userId, userId],
      )) as any[];
    }

    // Carrega dados do contato
    let contactRecord: any = null;
    try {
      const cRows = (await db.query(
        "SELECT * FROM contacts WHERE (user_id = ? OR tenant_id = ?) AND (phone_e164 LIKE ? OR phone_e164 LIKE ?) LIMIT 1",
        [userId, userId, `%${phoneDigits}%`, `%${phoneDigits.slice(-8)}%`],
      )) as any[];
      contactRecord = cRows?.[0] || null;
    } catch {
      contactRecord = null;
    }

    let parsedCustomFields: Record<string, any> = {};
    try {
      if (contactRecord?.custom_fields) {
        parsedCustomFields =
          typeof contactRecord.custom_fields === "string"
            ? JSON.parse(contactRecord.custom_fields)
            : contactRecord.custom_fields || {};
      }
    } catch {
      parsedCustomFields = {};
    }

    const executionContext: any = {
      tenantId: userId,
      userId,
      contact: {
        id: contactRecord?.id,
        phone: phoneDigits,
        name: contactRecord?.name || "",
        email: contactRecord?.email || "",
        company: contactRecord?.company || "",
        notes: contactRecord?.notes || "",
        customFields: parsedCustomFields,
      },
      message: {
        text: "",
        type: "text",
      },
      channel,
      flowId: stepToExecute?.flow_id,
      stepId: stepToExecute?.id,
      variables: {},
      httpResponse: null,
    };

    const CONTROL_TYPES = new Set(["delay", "condition", "randomizer", "save_variable", "http_request"]);
    let hops = 0;
    while (stepToExecute && CONTROL_TYPES.has(stepToExecute.message_type)) {
      hops++;
      if (hops > 50) break;

      let stepConfig: any = {};
      try {
        stepConfig =
          typeof stepToExecute.buttons_config === "string"
            ? JSON.parse(stepToExecute.buttons_config || "{}")
            : stepToExecute.buttons_config || {};
      } catch {
        stepConfig = {};
      }
      const ctrl = stepConfig.control || stepConfig;

      if (stepToExecute.message_type === "delay") {
        const duration = Number(ctrl.duration) || Number(stepToExecute.delay_seconds) || 5;
        const unit = ctrl.unit || "seconds";
        const delaySec = unit === "hours" ? duration * 3600 : unit === "minutes" ? duration * 60 : duration;
        const nextStepId = stepToExecute.next_step_id || ctrl.nextStepId || null;

        if (delaySec <= 10 && nextStepId) {
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
          stepToExecute = allSteps.find((s: any) => s.id === nextStepId) || null;
          continue;
        } else {
          await dbAdmin.from("bot_conversation_state").upsert(
            {
              user_id: userId,
              tenant_id: userId,
              contact_number: phoneDigits,
              instance_id: phoneNumberId,
              channel,
              current_step_id: stepToExecute.id,
              last_interaction: new Date().toISOString(),
              is_paused: true,
              paused_until: new Date(Date.now() + delaySec * 1000).toISOString(),
            },
            { onConflict: "user_id,contact_number,instance_id,channel" },
          );
          return;
        }
      } else if (stepToExecute.message_type === "condition") {
        const isTrue = evaluateCondition(ctrl, executionContext);
        const targetStepId = isTrue ? ctrl.trueStepId : ctrl.falseStepId;
        stepToExecute = targetStepId ? allSteps.find((s: any) => s.id === targetStepId) || null : null;
      } else if (stepToExecute.message_type === "randomizer") {
        executionContext.stepId = stepToExecute.id;
        const result = evaluateRandomizer(ctrl, executionContext);
        stepToExecute = result.nextStepId ? allSteps.find((s: any) => s.id === result.nextStepId) || null : null;
      } else if (stepToExecute.message_type === "save_variable") {
        const result = await executeSaveVariable(ctrl, executionContext, db);
        const targetStepId = result.nextStepId || stepToExecute.next_step_id;
        stepToExecute = targetStepId ? allSteps.find((s: any) => s.id === targetStepId) || null : null;
      } else if (stepToExecute.message_type === "http_request") {
        const httpRes = await executeHttpRequest(ctrl, executionContext);
        stepToExecute = httpRes.nextStepId ? allSteps.find((s: any) => s.id === httpRes.nextStepId) || null : null;
      }
    }

    if (!stepToExecute) return;

    if (stepToExecute.message_content) {
      stepToExecute.message_content = resolveTemplate(stepToExecute.message_content, executionContext);
    }
    if (stepToExecute.media_caption) {
      stepToExecute.media_caption = resolveTemplate(stepToExecute.media_caption, executionContext);
    }

    let isSuccess = false;
    let providerMsgId: string | null = null;
    let inactivitySentPayload: Record<string, unknown> | null = null;
    let inactivityBuildMeta: Record<string, unknown> | null = null;

    if (channel === "whatsapp") {
      const { data: p } = await dbAdmin
        .from("profiles")
        .select("whatsapp_access_token, meta_graph_version")
        .eq("id", userId)
        .maybeSingle();

      if (!p || !p.whatsapp_access_token) return;

      const apiVersion = p.meta_graph_version || process.env.META_GRAPH_VERSION || "v26.0";
      const preparedMedia = await prepareStepMediaForMeta(
        stepToExecute,
        phoneNumberId,
        p.whatsapp_access_token,
        apiVersion,
      );

      if (!preparedMedia.ok) {
        logError("BOTFLOW_MEDIA_PREPARATION_FAILED", { stepId: stepToExecute.id, reason: preparedMedia.message });
        return;
      }
      const build = buildWhatsAppBotMessage(phoneDigits, preparedMedia.step);
      if (!build.ok) {
        logError(build.code, { stepId: stepToExecute.id, messageType: stepToExecute.message_type, reason: build.message });
        return;
      }
      const { payload } = build;
      inactivitySentPayload = payload;
      inactivityBuildMeta = build.meta;

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
        .eq("instagram_business_account_id", phoneNumberId)
        .maybeSingle();

      if (!igAcc || !igAcc.access_token) {
        logError("Acesso ao Instagram não configurado ou token expirado");
        return;
      }

      const igRecipientId = phoneDigits.startsWith("ig_") ? phoneDigits.slice(3) : phoneDigits;
      const apiVersion = process.env.META_GRAPH_VERSION || "v26.0";

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
      const apiVersion = process.env.META_GRAPH_API_VERSION || "v26.0";

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
    } else if (channel === "webchat") {
      isSuccess = true;
      providerMsgId = crypto.randomUUID();
      logInfo("[BOT] WebChat bot response recorded", { stepId: stepToExecute.id, providerMsgId });
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
          is_paused: false,
          paused_until: null,
        },
        { onConflict: "user_id,contact_number,instance_id,channel" },
      );

      const msgType = ["image", "video", "audio", "document", "sticker", "location"].includes(
        stepToExecute.message_type,
      )
        ? stepToExecute.message_type
        : "text";
      const msgBody =
        stepToExecute.message_content ||
        stepToExecute.media_caption ||
        (stepToExecute.message_type === "document" ? "Documento enviado pelo bot" : "");

      await dbAdmin.from("direct_messages").insert({
        tenant_id: userId,
        user_id: userId,
        contact_phone: phoneDigits,
        direction: "outgoing",
        type: msgType,
        body: msgBody,
        channel,
        provider_message_id: providerMsgId,
        provider_account_id: phoneNumberId,
        status: "sent",
        metadata: {
          step_id: stepToExecute.id,
          bot_triggered: true,
          is_inactivity_trigger: true,
          payload: inactivitySentPayload,
          message_build: inactivityBuildMeta,
          media_url: stepToExecute.media_url,
          filename: stepToExecute.media_caption || "document.pdf",
          caption: stepToExecute.media_caption || stepToExecute.message_content,
        },
      });
      logInfo("Mensagem de inatividade enviada e salva", { providerMsgId, msgType });

      if (stepToExecute.flow_id) {
        await dbAdmin
          .from("bot_flows")
          .update({ last_executed_at: new Date().toISOString() })
          .eq("id", stepToExecute.flow_id)
          .eq("tenant_id", userId);
      }
    } else {
      // Envio falhou: limpa o paused_until para não ficar em loop eterno de
      // retentativas. O fluxo fica com is_paused = false e current_step_id
      // apontando para o step que falhou para diagnóstico.
      logError("Falha ao enviar mensagem de delay/inatividade; limpando pausa para evitar loop", {
        stepId: stepToExecute?.id,
        phoneDigits,
      });
      await dbAdmin
        .from("bot_conversation_state")
        .update({ is_paused: false, paused_until: null })
        .eq("user_id", userId)
        .eq("contact_number", phoneDigits)
        .eq("instance_id", phoneNumberId)
        .eq("channel", channel);
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
