import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "@/lib/db";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { processBotFlow } from "@/lib/botflow-executor.server";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

interface JsonObject {
  [key: string]: JsonValue;
}

interface WebhookEntry {
  changes?: WebhookChange[];
}

interface WebhookChange {
  field?: string;
  value?: WebhookValue;
}

interface WebhookContactProfile {
  name?: string;
}

interface WebhookContact {
  wa_id?: string;
  profile?: WebhookContactProfile;
}

interface WebhookMessageStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: JsonValue;
  pricing?: {
    billable?: boolean | null;
    category?: string | null;
    pricing_model?: string | null;
  };
  conversation?: {
    id?: string | null;
    origin?: {
      type?: string | null;
    };
  };
}

interface WebhookInteractiveMessage {
  type?: string;
  button_reply?: {
    title?: string;
    id?: string;
  };
  list_reply?: {
    title?: string;
    id?: string;
  };
  nfm_reply?: {
    name?: string;
    response_json?: string;
  };
}

interface WebhookMessageContactCard {
  name?: {
    formatted_name?: string;
  };
  phones?: Array<{
    phone?: string;
  }>;
}

interface WebhookInboundMessage {
  id?: string;
  from?: string;
  type?: string;
  group_id?: string | null;
  group_name?: string | null;
  recipient_type?: string | null;
  text?: {
    body?: string;
  };
  button?: {
    text?: string;
    payload?: string;
  };
  interactive?: WebhookInteractiveMessage;
  reaction?: {
    emoji?: string;
  };
  image?: {
    id?: string;
  };
  audio?: {
    id?: string;
  };
  video?: {
    id?: string;
  };
  document?: {
    id?: string;
  };
  sticker?: {
    id?: string;
  };
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  contacts?: WebhookMessageContactCard[];
  context?: {
    message_id?: string | null;
  };
}

interface WebhookValue {
  metadata?: {
    phone_number_id?: string;
    display_phone_number?: string;
  };
  statuses?: WebhookMessageStatus[];
  messages?: WebhookInboundMessage[];
  contacts?: WebhookContact[];
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  event?: string;
  new_category?: string;
}

interface WebhookPayload {
  entry?: WebhookEntry[];
}

interface ProfileIdRow {
  id: string;
}

interface ProfileWebhookRow extends ProfileIdRow {
  whatsapp_app_secret?: string | null;
  whatsapp_phone_number_id?: string | null;
}

interface CampaignMessageRow {
  campaign_id: string | null;
}

interface ContactLookupRow extends ProfileIdRow {
  name?: string | null;
  custom_fields?: JsonObject | null;
  chat_status?: string | null;
}

type GroupParticipantRow = ProfileIdRow;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonObject(value: unknown): JsonObject | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseJsonObject(parsed);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const result: JsonObject = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      result[key] = entry;
      continue;
    }

    if (Array.isArray(entry)) {
      result[key] = entry as JsonValue[];
      continue;
    }

    const nestedObject = parseJsonObject(entry);
    if (nestedObject) {
      result[key] = nestedObject;
    }
  }

  return result;
}

function getJsonString(source: JsonObject | null, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

function getNestedJsonObject(source: JsonObject | null, key: string): JsonObject | null {
  const value = source?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function logInfo(message: string, data?: unknown) {
  console.log(`[whatsapp-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: unknown) {
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

function extractPhoneNumberIds(payload: WebhookPayload | null): string[] {
  const ids = new Set<string>();
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const phoneNumberId = change?.value?.metadata?.phone_number_id;
      if (phoneNumberId) ids.add(String(phoneNumberId));
    }
  }
  return Array.from(ids);
}

async function resolveWebhookUser(
  rawBody: string,
  signatureHeader: string | null,
  payload: WebhookPayload | null,
) {
  const envSecret = process.env.META_APP_SECRET;
  if (envSecret && (await verifySignature(rawBody, signatureHeader, envSecret))) {
    const phoneIds = extractPhoneNumberIds(payload);
    if (phoneIds.length > 0) {
      const { data: byPhone } = await dbAdmin
        .from("profiles")
        .select("id")
        .in("whatsapp_phone_number_id", phoneIds)
        .limit(2);
      const typedByPhone = (byPhone ?? []) as ProfileIdRow[];
      if (typedByPhone.length === 1) {
        return { userId: typedByPhone[0].id, reason: "env_secret_phone_number_id" as const };
      }
      if (typedByPhone.length > 1) {
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
    const typedOnlyOne = (onlyOne ?? []) as ProfileIdRow[];
    if (typedOnlyOne.length === 1) {
      return { userId: typedOnlyOne[0].id, reason: "env_secret_single_profile" as const };
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

  for (const profile of (profiles ?? []) as ProfileWebhookRow[]) {
    if (
      profile.whatsapp_app_secret &&
      (await verifySignature(rawBody, signatureHeader, profile.whatsapp_app_secret))
    ) {
      verifiedProfiles.push(profile);
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

async function processStatusUpdate(value: WebhookValue | undefined, userId: string) {
  const statuses = value?.statuses ?? [];
  for (const s of statuses) {
    const waId = normalizeWaMessageId(s.id);
    if (!waId) continue;
    const status = s.status;
    const timestamp = s.timestamp
      ? new Date(Number(s.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const update: Record<string, JsonValue> = {};

    const allowedCampaignStatuses = ["pending", "sending", "sent", "delivered", "read", "failed"];
    if (typeof status === "string" && allowedCampaignStatuses.includes(status)) {
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
    let rows: CampaignMessageRow[] | null = null;
    if (Object.keys(update).length > 0) {
      const { data } = await dbAdmin
        .from("campaign_messages")
        .update(update)
        .eq("wa_message_id", waId)
        .eq("user_id", userId)
        .select("campaign_id");
      rows = (data ?? null) as CampaignMessageRow[] | null;
    }

    // Update status in direct_messages table too
    const allowedDirectStatuses = ["sent", "delivered", "read", "failed"];
    if (typeof status === "string" && allowedDirectStatuses.includes(status)) {
      await dbAdmin
        .from("direct_messages")
        .update({ status })
        .eq("wa_message_id", waId)
        .eq("user_id", userId);

      await dbAdmin
        .from("direct_messages")
        .update({ status })
        .eq("provider_message_id", waId)
        .eq("user_id", userId);
    }

    const campaignIds = Array.from(new Set((rows ?? []).map((row) => row.campaign_id))).filter(
      (campaignId): campaignId is string => Boolean(campaignId),
    );
    if (campaignIds.length > 0) {
      for (const cid of campaignIds) {
        await db.query(
          `
          UPDATE campaigns c
          SET totals = (
            SELECT JSON_OBJECT(
              'total', COUNT(*),
              'pending', CAST(COALESCE(SUM(status='pending'), 0) AS SIGNED),
              'sending', CAST(COALESCE(SUM(status='sending'), 0) AS SIGNED),
              'sent', CAST(COALESCE(SUM(status='sent'), 0) AS SIGNED),
              'delivered', CAST(COALESCE(SUM(status='delivered'), 0) AS SIGNED),
              'read', CAST(COALESCE(SUM(status='read'), 0) AS SIGNED),
              'failed', CAST(COALESCE(SUM(status='failed'), 0) AS SIGNED)
            ) FROM campaign_messages WHERE campaign_id = c.id AND user_id = ?
          )
          WHERE c.id = ? AND c.user_id = ?
        `,
          [userId, cid, userId],
        );
      }
    }
  }
}

async function processInboundMessages(value: WebhookValue | undefined, userId: string) {
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

async function processInboundDirectMessages(value: WebhookValue | undefined, userId: string) {
  const messages = value?.messages ?? [];
  const waContacts = value?.contacts ?? [];
  const waIdToName = new Map<string, string>();
  for (const c of waContacts) {
    const waId = c?.wa_id ? String(c.wa_id) : null;
    const name = c?.profile?.name ? String(c.profile.name) : "";
    if (waId) {
      waIdToName.set(waId, name);
      waIdToName.set(waId.replace(/\D+/g, ""), name);
    }
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

    const isGroupMessage = m.recipient_type === "group" || Boolean(m.group_id);
    if (isGroupMessage) {
      await handleWhatsAppGroupMessage(m, waIdToName, userId, value, phoneNumberId);
      continue;
    }

    const waMessageId = normalizeWaMessageId(m.id);
    const phoneDigits = from.replace(/\D+/g, "");

    // Garante que o contato exista para o chat renderizar a conversa na lista
    // e preserva custom_fields já existentes, como avatar_url.
    const contactName = waIdToName.get(phoneDigits) || "";
    const { data: existingContact } = await dbAdmin
      .from("contacts")
      .select("id, name, custom_fields, chat_status")
      .eq("user_id", userId)
      .eq("phone_e164", phoneDigits)
      .maybeSingle();

    const parsedExistingCustomFields = parseJsonObject(
      (existingContact as ContactLookupRow | null)?.custom_fields,
    );
    const existingCustomFields = parsedExistingCustomFields
      ? { ...parsedExistingCustomFields }
      : {};

    const nextChatStatus =
      !existingContact || !existingContact.chat_status || existingContact.chat_status === "fechado"
        ? "aguardando"
        : undefined;

    const contactPayload = {
      name: contactName || existingContact?.name || undefined,
      source: "whatsapp_inbound",
      is_unread: true,
      chat_status: nextChatStatus,
      custom_fields: {
        ...existingCustomFields,
        wa_id: m.from,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
      },
    };

    if (existingContact?.id) {
      await dbAdmin.from("contacts").update(contactPayload).eq("id", existingContact.id);
    } else {
      await dbAdmin.from("contacts").insert({
        id: randomUUID(),
        user_id: userId,
        phone_e164: phoneDigits,
        channel: "whatsapp",
        ...contactPayload,
      });
    }

    if (
      !existingContact ||
      !existingContact.chat_status ||
      existingContact.chat_status === "fechado"
    ) {
      const { data: refreshedContact } = await dbAdmin
        .from("contacts")
        .select("id")
        .eq("user_id", userId)
        .eq("phone_e164", phoneDigits)
        .maybeSingle();

      if (refreshedContact?.id) {
        const { startChatSession } = await import("@/lib/chat-sessions.functions");
        await startChatSession(userId, refreshedContact.id, "aguardando");
      }
    }

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
      let responseJsonObj: JsonObject | null = null;

      if (m.interactive?.type === "nfm_reply" && m.interactive.nfm_reply?.name === "flow") {
        const responseJsonStr = m.interactive.nfm_reply.response_json;
        if (responseJsonStr) {
          try {
            responseJsonObj = parseJsonObject(responseJsonStr);
            flowToken = getJsonString(responseJsonObj, "flow_token") || "";
            isFlowReply = true;
            body = "[Formulário Flow Enviado]";

            const flowResponseParams = getNestedJsonObject(
              responseJsonObj,
              "wa_flow_response_params",
            );
            // Grava a submissão
            const submissionId = randomUUID();
            await dbAdmin.from("whatsapp_flow_submissions").insert({
              id: submissionId,
              user_id: userId,
              contact_phone: phoneDigits,
              flow_id: getJsonString(flowResponseParams, "flow_id") || "unknown",
              flow_token: flowToken,
              response_json: responseJsonObj,
            });
            logInfo("Submissão de Flow registrada com sucesso", { submissionId });
          } catch (error: unknown) {
            logError("Erro ao processar submissão do WhatsApp Flow", error);
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
              const configObj = parseJsonObject(step.buttons_config);
              const nextSuccess = configObj?.next_step_on_success;
              if (nextSuccess) {
                buttonPayload = `step:${nextSuccess}`;
              }
            } catch (error: unknown) {
              logError("Erro ao processar buttons_config do step original do flow", error);
            }
          }
        }
      }
    } else {
      body = `[Mensagem de tipo ${m.type} recebida]`;
    }

    const reply_to_message_id = m.context?.message_id ?? null;

    const { data: existingMessage } = await dbAdmin
      .from("direct_messages")
      .select("id")
      .eq("user_id", userId)
      .eq("wa_message_id", waMessageId)
      .maybeSingle();

    if (existingMessage?.id) {
      continue;
    }

    await dbAdmin.from("direct_messages").insert({
      id: randomUUID(),
      user_id: userId,
      contact_phone: phoneDigits,
      direction: "incoming",
      type,
      body,
      wa_message_id: waMessageId,
      status: "delivered",
      reply_to_message_id,
      channel: "whatsapp",
      provider_account_id: phoneNumberId,
      metadata: {
        message: m,
        contacts: waContacts,
        metadata: value?.metadata ?? null,
      },
      raw_payload: value ?? null,
    });

    // 🚀 Chama o motor do BotFlow para processar essa mensagem
    if (phoneNumberId && body) {
      await processBotFlow(body, phoneDigits, phoneNumberId, userId, buttonPayload);
    }
  }
}

async function processTemplateStatusUpdate(value: WebhookValue | undefined, userId: string) {
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
  const update: Record<string, JsonValue> = { status, synced_at: new Date().toISOString() };
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

async function processTemplateCategoryUpdate(value: WebhookValue | undefined, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const newCategory = value?.new_category as string | undefined;
  if (!metaId || !newCategory) return;
  await dbAdmin
    .from("templates")
    .update({ category: newCategory, synced_at: new Date().toISOString() })
    .eq("meta_template_id", metaId)
    .eq("user_id", userId);
}

async function handleWhatsAppGroupMessage(
  m: WebhookInboundMessage,
  waIdToName: Map<string, string>,
  userId: string,
  rawPayload: WebhookValue | undefined,
  phoneNumberId: string | null,
) {
  if (process.env.WHATSAPP_GROUPS_ENABLED !== "true") {
    logInfo("Mensagem de grupo ignorada pois WHATSAPP_GROUPS_ENABLED não é true");
    return;
  }

  const groupId = m.group_id || (m.recipient_type === "group" ? m.from : null);
  if (!groupId) return;

  const senderWaId = m.from ?? ""; // O participante
  const senderName = waIdToName.get(senderWaId) || "Participante";

  // 1. Encontrar ou criar o grupo no banco
  const { data: existingGroup } = await dbAdmin
    .from("whatsapp_groups")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  let group = existingGroup;
  if (!group) {
    const newGroupId = randomUUID();
    const groupName = m.group_name || `Grupo WhatsApp (${groupId.split("@")[0]})`;
    const newGroup = {
      id: newGroupId,
      user_id: userId,
      instance_id: phoneNumberId,
      group_id: groupId,
      name: groupName,
      status: "active",
    };
    await dbAdmin.from("whatsapp_groups").insert(newGroup);
    group = newGroup;
  }

  // 2. Garantir que o contato virtual do grupo exista na tabela contacts (com canal 'whatsapp_group')
  const { data: existingContact } = await dbAdmin
    .from("contacts")
    .select("id, name, chat_status")
    .eq("user_id", userId)
    .eq("phone_e164", groupId)
    .maybeSingle();

  if (!existingContact) {
    await dbAdmin.from("contacts").insert({
      id: randomUUID(),
      user_id: userId,
      phone_e164: groupId,
      name: group.name,
      source: "whatsapp_group",
      channel: "whatsapp_group",
      is_unread: true,
      chat_status: "aguardando",
    });
  } else {
    await dbAdmin
      .from("contacts")
      .update({
        is_unread: true,
        chat_status:
          !existingContact.chat_status || existingContact.chat_status === "fechado"
            ? "aguardando"
            : undefined,
      })
      .eq("id", existingContact.id);
  }

  if (
    !existingContact ||
    !existingContact.chat_status ||
    existingContact.chat_status === "fechado"
  ) {
    const { data: refreshedContact } = await dbAdmin
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_e164", groupId)
      .maybeSingle();

    if (refreshedContact?.id) {
      const { startChatSession } = await import("@/lib/chat-sessions.functions");
      await startChatSession(userId, refreshedContact.id, "aguardando");
    }
  }

  // 3. Atualizar/inserir o participante na tabela whatsapp_group_participants
  const { data: existingParticipant } = await dbAdmin
    .from("whatsapp_group_participants")
    .select("id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("wa_id", senderWaId)
    .maybeSingle();

  if (!existingParticipant) {
    await dbAdmin.from("whatsapp_group_participants").insert({
      id: randomUUID(),
      user_id: userId,
      group_id: groupId,
      wa_id: senderWaId,
      name: senderName,
      status: "active",
    });
  } else {
    await dbAdmin
      .from("whatsapp_group_participants")
      .update({
        name: senderName,
        status: "active",
      })
      .eq("id", (existingParticipant as GroupParticipantRow).id);
  }

  // 4. Salvar a mensagem na tabela direct_messages
  const waMessageId = normalizeWaMessageId(m.id);
  const type = m.type ?? "text";
  let body = "";
  if (m.type === "text") {
    body = m.text?.body ?? "";
  } else {
    body = `[Mensagem de tipo ${m.type} recebida]`;
  }

  const reply_to_message_id = m.context?.message_id ?? null;

  const { data: existingGroupMessage } = await dbAdmin
    .from("direct_messages")
    .select("id")
    .eq("user_id", userId)
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (existingGroupMessage?.id) {
    return;
  }

  await dbAdmin.from("direct_messages").upsert(
    {
      id: randomUUID(),
      user_id: userId,
      contact_phone: groupId, // A conversa é vinculada ao ID do grupo
      direction: "incoming",
      type,
      body,
      wa_message_id: waMessageId,
      status: "delivered",
      reply_to_message_id,
      channel: "whatsapp_group",
      provider_account_id: phoneNumberId,
      sender_wa_id: senderWaId,
      sender_name: senderName,
      recipient_type: "group",
      external_group_id: groupId,
      raw_payload: rawPayload ?? null,
    },
    { onConflict: "wa_message_id" },
  );

  // 🚀 Chama o motor do BotFlow para processar essa mensagem do grupo (se habilitado)
  if (process.env.WHATSAPP_GROUPS_ENABLED === "true" && phoneNumberId && body) {
    await processBotFlow(body, groupId, phoneNumberId, userId, undefined, "whatsapp_group");
  }
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

        let payload: WebhookPayload | null = null;
        try {
          payload = JSON.parse(rawBody) as WebhookPayload;
        } catch (error: unknown) {
          logError("POST inválido (JSON parse)", { error: getErrorMessage(error) });
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
            } catch (error: unknown) {
              logError("Erro ao processar POST", {
                error: getErrorMessage(error),
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
