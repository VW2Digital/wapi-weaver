import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "@/lib/db";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { processBotFlow } from "@/lib/botflow-executor.server";

function logInfo(message: string, data?: any) {
  console.log(`[whatsapp-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[whatsapp-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

function extractPhoneNumberIds(payload: any): string[] {
  const ids = new Set<string>();
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const phoneNumberId = change?.value?.metadata?.phone_number_id;
      if (phoneNumberId) ids.add(String(phoneNumberId));
    }
  }
  return Array.from(ids);
}

async function resolveWebhookUser(rawBody: string, signatureHeader: string | null, payload: any) {
  const envSecret = process.env.META_APP_SECRET;
  if (envSecret && (await verifySignature(rawBody, signatureHeader, envSecret))) {
    const phoneIds = extractPhoneNumberIds(payload);
    if (phoneIds.length > 0) {
      const { data: byPhone } = await dbAdmin
        .from("profiles")
        .select("id")
        .in("whatsapp_phone_number_id", phoneIds)
        .limit(2);
      if (byPhone && byPhone.length === 1) {
        return { userId: byPhone[0].id as string, reason: "env_secret_phone_number_id" as const };
      }
      if (byPhone && byPhone.length > 1) {
        return { userId: null, reason: "ambiguous_phone_number_id" as const };
      }
    }
    // Fallback para ambientes single-tenant: se existir apenas 1 perfil com phone_number_id configurado,
    // assume ele como dono do webhook.
    const { data: onlyOne } = await dbAdmin
      .from("profiles")
      .select("id")
      .not("whatsapp_phone_number_id", "is", null)
      .limit(2);
    if (onlyOne && onlyOne.length === 1) {
      return { userId: onlyOne[0].id as string, reason: "env_secret_single_profile" as const };
    }

    return { userId: null, reason: "signature_ok_but_user_unknown" as const };
  }

  const { data: profiles } = await dbAdmin
    .from("profiles")
    .select("id, whatsapp_app_secret, whatsapp_phone_number_id")
    .not("whatsapp_app_secret", "is", null);

  const verifiedProfiles: Array<{
    id: string;
    whatsapp_app_secret?: string | null;
    whatsapp_phone_number_id?: string | null;
  }> = [];

  for (const profile of profiles ?? []) {
    if (
      profile.whatsapp_app_secret &&
      (await verifySignature(rawBody, signatureHeader, profile.whatsapp_app_secret))
    ) {
      verifiedProfiles.push(profile as any);
    }
  }

  if (verifiedProfiles.length === 0) {
    return { userId: null, reason: "invalid_signature" as const };
  }

  const payloadPhoneIds = extractPhoneNumberIds(payload);
  if (payloadPhoneIds.length > 0) {
    const byPhoneId = verifiedProfiles.filter(
      (profile) =>
        profile.whatsapp_phone_number_id &&
        payloadPhoneIds.includes(String(profile.whatsapp_phone_number_id)),
    );

    if (byPhoneId.length === 1) {
      return { userId: byPhoneId[0].id, reason: "phone_number_id" as const };
    }

    if (byPhoneId.length > 1) {
      return { userId: null, reason: "ambiguous_phone_number_id" as const };
    }
  }

  if (verifiedProfiles.length === 1) {
    return { userId: verifiedProfiles[0].id, reason: "signature_only" as const };
  }

  return { userId: null, reason: "ambiguous_signature" as const };
}

const OPT_OUT_KEYWORDS = [
  "stop",
  "sair",
  "parar",
  "cancelar",
  "descadastrar",
  "unsubscribe",
  "remover",
];

async function processStatusUpdate(value: any, userId: string) {
  const statuses = value?.statuses ?? [];
  for (const s of statuses) {
    const waId = normalizeWaMessageId(s.id);
    if (!waId) continue;
    const status = s.status;
    const timestamp = s.timestamp
      ? new Date(Number(s.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const update: any = {};

    const allowedCampaignStatuses = ["pending", "sending", "sent", "delivered", "read", "failed"];
    if (allowedCampaignStatuses.includes(status)) {
      update.status = status;
    }

    if (status === "delivered") update.delivered_at = timestamp;
    if (status === "read") update.read_at = timestamp;
    if (status === "failed") {
      update.failed_at = timestamp;
      update.error = s.errors ?? null;
    }
    if (s.pricing) {
      update.pricing_billable = s.pricing.billable ?? null;
      update.pricing_category = s.pricing.category ?? null;
      update.pricing_model = s.pricing.pricing_model ?? null;
    }
    if (s.conversation) {
      update.conversation_id = s.conversation.id ?? null;
      update.conversation_origin = s.conversation.origin?.type ?? null;
    }

    // SECURITY: scope mutation to the verified user
    let rows: any[] | null = null;
    if (Object.keys(update).length > 0) {
      const { data } = await dbAdmin
        .from("campaign_messages")
        .update(update)
        .eq("wa_message_id", waId)
        .eq("user_id", userId)
        .select("campaign_id");
      rows = data;
    }

    // Update status in direct_messages table too
    const allowedDirectStatuses = ["sent", "delivered", "read", "failed"];
    if (allowedDirectStatuses.includes(status)) {
      await dbAdmin
        .from("direct_messages")
        .update({ status })
        .eq("wa_message_id", waId)
        .eq("user_id", userId);
    }

    const campaignIds = Array.from(new Set((rows ?? []).map((r: any) => r.campaign_id))).filter(
      Boolean,
    );
    if (campaignIds.length > 0) {
      await db.query(
        `
        UPDATE campaigns c
        SET totals = (
          SELECT JSON_OBJECT(
            'total', COUNT(*),
            'pending', CAST(SUM(status='pending') AS SIGNED),
            'sent', CAST(SUM(status='sent') AS SIGNED),
            'delivered', CAST(SUM(status='delivered') AS SIGNED),
            'read', CAST(SUM(status='read') AS SIGNED),
            'failed', CAST(SUM(status='failed') AS SIGNED)
          ) FROM campaign_messages WHERE campaign_id = c.id AND user_id = ?
        )
        WHERE c.id IN (?) AND c.user_id = ?
      `,
        [userId, campaignIds, userId],
      );
    }
  }
}

async function processInboundMessages(value: any, userId: string) {
  const messages = value?.messages ?? [];
  for (const m of messages) {
    const from: string | undefined = m.from;
    if (!from) continue;
    const text = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "")
      .toString()
      .trim()
      .toLowerCase();
    if (!text) continue;
    const isOptOut = OPT_OUT_KEYWORDS.some(
      (k) => text === k || text.startsWith(`${k} `) || text.endsWith(` ${k}`),
    );
    if (!isOptOut) continue;
    // Contatos salvos sem "+" (apenas dígitos com DDI). Meta envia sem "+" também.
    const phoneDigits = from.replace(/\D+/g, "");
    await dbAdmin
      .from("contacts")
      .update({ opted_out: true })
      .eq("user_id", userId)
      .eq("phone_e164", phoneDigits);
  }
}

async function processInboundDirectMessages(value: any, userId: string) {
  const messages = value?.messages ?? [];
  const waContacts = value?.contacts ?? [];
  const waIdToName = new Map<string, string>();
  for (const c of waContacts) {
    const waId = c?.wa_id ? String(c.wa_id) : null;
    const name = c?.profile?.name ? String(c.profile.name) : "";
    if (waId) waIdToName.set(waId, name);
  }

  const phoneNumberId = value?.metadata?.phone_number_id
    ? String(value.metadata.phone_number_id)
    : null;
  const displayPhoneNumber = value?.metadata?.display_phone_number
    ? String(value.metadata.display_phone_number)
    : null;

  for (const m of messages) {
    const from: string | undefined = m.from;
    if (!from) continue;
    const waMessageId = normalizeWaMessageId(m.id);
    const phoneDigits = from.replace(/\D+/g, "");

    // Garante que o contato exista para o chat renderizar a conversa na lista
    // e preserva custom_fields já existentes, como avatar_url.
    const contactName = waIdToName.get(phoneDigits) || "";
    const { data: existingContact } = await dbAdmin
      .from("contacts")
      .select("id, name, custom_fields")
      .eq("user_id", userId)
      .eq("phone_e164", phoneDigits)
      .maybeSingle();

    const existingCustomFields =
      existingContact?.custom_fields && typeof existingContact.custom_fields === "object"
        ? { ...(existingContact.custom_fields as Record<string, any>) }
        : {};

    await dbAdmin.from("contacts").upsert({
      user_id: userId,
      phone_e164: phoneDigits,
      name: contactName || existingContact?.name || undefined,
      source: "whatsapp_inbound",
      custom_fields: {
        ...existingCustomFields,
        wa_id: m.from,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
      },
    });

    let type = m.type ?? "text";
    const allowedTypes = new Set([
      "text",
      "reaction",
      "image",
      "audio",
      "video",
      "document",
      "sticker",
      "location",
      "contacts",
    ]);
    if (!allowedTypes.has(type)) {
      type = "text";
    }

    let body = "";
    let buttonPayload = "";
    if (m.type === "text") {
      body = m.text?.body ?? "";
    } else if (m.type === "reaction") {
      body = m.reaction?.emoji ?? "";
    } else if (m.type === "image") {
      body = m.image?.id ?? "";
    } else if (m.type === "audio") {
      body = m.audio?.id ?? "";
    } else if (m.type === "video") {
      body = m.video?.id ?? "";
    } else if (m.type === "document") {
      body = m.document?.id ?? "";
    } else if (m.type === "sticker") {
      body = m.sticker?.id ?? "";
    } else if (m.type === "location") {
      body = m.location?.name || `${m.location?.latitude}, ${m.location?.longitude}`;
    } else if (m.type === "contacts") {
      body =
        m.contacts?.[0]?.name?.formatted_name || m.contacts?.[0]?.phones?.[0]?.phone || "Contato";
    } else if (m.type === "button") {
      body = m.button?.text ?? "[Botão]";
      buttonPayload = m.button?.payload ?? "";
    } else if (m.type === "interactive") {
      let isFlowReply = false;
      let flowToken = "";
      let responseJsonObj: any = null;

      if (m.interactive?.type === "nfm_reply" && m.interactive.nfm_reply?.name === "flow") {
        const responseJsonStr = m.interactive.nfm_reply.response_json;
        if (responseJsonStr) {
          try {
            responseJsonObj = JSON.parse(responseJsonStr);
            flowToken = responseJsonObj?.flow_token || "";
            isFlowReply = true;
            body = "[Formulário Flow Enviado]";

            // Grava a submissão
            const submissionId = randomUUID();
            await dbAdmin.from("whatsapp_flow_submissions").insert({
              id: submissionId,
              user_id: userId,
              contact_phone: phoneDigits,
              flow_id: responseJsonObj?.wa_flow_response_params?.flow_id || "unknown",
              flow_token: flowToken,
              response_json: responseJsonObj,
            });
            logInfo("Submissão de Flow registrada com sucesso", { submissionId });
          } catch (e: any) {
            logError("Erro ao processar submissão do WhatsApp Flow", e);
          }
        }
      }

      if (!isFlowReply) {
        body =
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          "[Interação recebida]";
        buttonPayload = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? "";
      } else {
        // Para Flow, precisamos obter o next_step_on_success
        // O flowToken tem o formato "session:<telefone>:<stepId>"
        let originalStepId = "";
        if (flowToken && flowToken.startsWith("session:")) {
          const parts = flowToken.split(":");
          if (parts.length >= 3) {
            originalStepId = parts[2];
          }
        }

        if (originalStepId) {
          const { data: step } = await dbAdmin
            .from("bot_steps")
            .select("buttons_config")
            .eq("id", originalStepId)
            .maybeSingle();

          if (step && step.buttons_config) {
            try {
              const configObj =
                typeof step.buttons_config === "string"
                  ? JSON.parse(step.buttons_config)
                  : step.buttons_config;
              const nextSuccess = configObj?.next_step_on_success;
              if (nextSuccess) {
                buttonPayload = `step:${nextSuccess}`;
              }
            } catch (e: any) {
              logError("Erro ao processar buttons_config do step original do flow", e);
            }
          }
        }
      }
    } else {
      body = `[Mensagem de tipo ${m.type} recebida]`;
    }

    const reply_to_message_id = m.context?.message_id ?? null;

    // Salva na tabela direct_messages (dedupe por wa_message_id via UNIQUE KEY)
    await dbAdmin.from("direct_messages").upsert({
      user_id: userId,
      contact_phone: phoneDigits,
      direction: "incoming",
      type,
      body,
      wa_message_id: waMessageId,
      status: "delivered",
      reply_to_message_id,
      metadata: {
        message: m,
        contacts: waContacts,
        metadata: value?.metadata ?? null,
      },
    });

    // 🚀 Chama o motor do BotFlow para processar essa mensagem
    if (phoneNumberId && body) {
      await processBotFlow(body, phoneDigits, phoneNumberId, userId, buttonPayload);
    }
  }
}

async function processTemplateStatusUpdate(value: any, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const name = value?.message_template_name as string | undefined;
  const language = value?.message_template_language as string | undefined;
  const event = (value?.event as string | undefined)?.toUpperCase();
  const statusMap: Record<string, string> = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING: "PENDING",
    IN_APPEAL: "PENDING",
    PENDING_DELETION: "PENDING",
    DELETED: "DISABLED",
    DISABLED: "DISABLED",
    PAUSED: "PAUSED",
    FLAGGED: "PAUSED",
    REINSTATED: "APPROVED",
  };
  const status = event && statusMap[event];
  if (!status) return;
  const update: any = { status, synced_at: new Date().toISOString() };
  if (metaId) {
    await dbAdmin
      .from("templates")
      .update(update)
      .eq("meta_template_id", metaId)
      .eq("user_id", userId);
  } else if (name && language) {
    await dbAdmin
      .from("templates")
      .update(update)
      .eq("name", name)
      .eq("language", language)
      .eq("user_id", userId);
  }
}

async function processTemplateCategoryUpdate(value: any, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const newCategory = value?.new_category as string | undefined;
  if (!metaId || !newCategory) return;
  await dbAdmin
    .from("templates")
    .update({ category: newCategory, synced_at: new Date().toISOString() })
    .eq("meta_template_id", metaId)
    .eq("user_id", userId);
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        logInfo("GET recebido", { mode, hasToken: !!token });
        if (mode !== "subscribe" || !token) return new Response("Bad Request", { status: 400 });

        const envToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (envToken && token === envToken) {
          logInfo("GET validado (env token)");
          return new Response(challenge ?? "", { status: 200 });
        }

        // Fallback (multi-tenant): aceita tokens salvos no profile, para compatibilidade
        const { data: profiles } = await dbAdmin
          .from("profiles")
          .select("id")
          .eq("whatsapp_verify_token", token)
          .limit(1);
        if (!profiles || profiles.length === 0) {
          logInfo("GET recusado (token inválido)");
          return new Response("Forbidden", { status: 403 });
        }

        logInfo("GET validado (profile token)");
        return new Response(challenge ?? "", { status: 200 });
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        logInfo("POST recebido", { hasSignature: !!sig, bytes: rawBody.length });

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (e: any) {
          logError("POST inválido (JSON parse)", { error: e?.message });
          return new Response("Bad Request", { status: 400 });
        }

        const resolved = await resolveWebhookUser(rawBody, sig, payload);
        const matchedUserId = resolved.userId;

        if (!matchedUserId) {
          await dbAdmin.from("webhook_events").insert({
            source: "whatsapp",
            raw: {
              rejected: true,
              reason: resolved.reason,
              phone_number_ids: extractPhoneNumberIds(payload),
              body: rawBody.slice(0, 4000),
            },
          });
          logError("POST recusado (não foi possível resolver user)", {
            reason: resolved.reason,
            phone_number_ids: extractPhoneNumberIds(payload),
          });
          return new Response("Webhook user could not be resolved", { status: 401 });
        }

        // Salva o payload bruto para debug e processa em seguida
        const { data: evRow } = await dbAdmin
          .from("webhook_events")
          .insert({ source: "whatsapp", raw: payload, user_id: matchedUserId })
          .select("id")
          .single();

        // Responde rápido para a Meta e processa de forma assíncrona
        setTimeout(() => {
          (async () => {
            try {
              for (const entry of payload.entry ?? []) {
                for (const change of entry.changes ?? []) {
                  if (change.field === "messages") {
                    await processStatusUpdate(change.value, matchedUserId);
                    await processInboundMessages(change.value, matchedUserId);
                    await processInboundDirectMessages(change.value, matchedUserId);
                  } else if (change.field === "message_template_status_update") {
                    await processTemplateStatusUpdate(change.value, matchedUserId);
                  } else if (change.field === "template_category_update") {
                    await processTemplateCategoryUpdate(change.value, matchedUserId);
                  } else {
                    logInfo("Evento ignorado", { field: change.field });
                  }
                }
              }

              if (evRow?.id) {
                await dbAdmin.from("webhook_events").update({ processed: true }).eq("id", evRow.id);
              }

              logInfo("POST processado com sucesso", { eventId: evRow?.id ?? null });
            } catch (err: any) {
              logError("Erro ao processar POST", {
                error: err?.message,
                eventId: evRow?.id ?? null,
              });
            }
          })();
        }, 0);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
