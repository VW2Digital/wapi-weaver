import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "@/lib/db";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { processBotFlow } from "@/lib/botflow-executor.server";
import { webhookQueue } from "@/lib/queue/webhook-queue";

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
  to?: string;
  timestamp?: string;
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
  messaging_product?: string;
  metadata?: {
    phone_number_id?: string;
    display_phone_number?: string;
  };
  statuses?: WebhookMessageStatus[];
  messages?: WebhookInboundMessage[];
  message_echoes?: WebhookInboundMessage[];
  contacts?: WebhookContact[];
  state_sync?: WebhookStateSyncItem[];
  history?: WebhookHistorySyncItem[];
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
type DirectMessageDirection = "incoming" | "outgoing";
type DirectMessageType =
  | "text"
  | "reaction"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts";

interface WebhookStateSyncItem {
  type?: string;
  action?: string;
  contact?: {
    full_name?: string;
    first_name?: string;
    phone_number?: string;
  };
  metadata?: {
    timestamp?: string;
  };
}

interface WebhookHistorySyncItem {
  metadata?: {
    phase?: number;
    chunk_order?: number;
    progress?: number;
  };
  threads?: WebhookHistoryThread[];
  errors?: WebhookHistoryError[];
}

interface WebhookHistoryThread {
  id?: string;
  messages?: WebhookHistoryMessage[];
}

interface WebhookHistoryMessage extends WebhookInboundMessage {
  history_context?: {
    status?: string;
  };
}

interface WebhookHistoryError {
  code?: number;
  title?: string;
  message?: string;
  error_data?: {
    details?: string;
  };
}

interface EnsureWhatsAppContactOptions {
  userId: string;
  phoneDigits: string;
  contactName?: string | null;
  source?: string;
  markUnread?: boolean;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  waId?: string | null;
  extraCustomFields?: JsonObject;
}

interface EnsureWhatsAppContactResult {
  existingContact: ContactLookupRow | null;
  contactId: string | null;
  nextChatStatus: string | null;
}

interface ResolvedDirectMessageContent {
  type: DirectMessageType;
  body: string;
  buttonPayload: string;
  isHistoryMediaPlaceholder: boolean;
}

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

function normalizePhoneDigits(value: string | null | undefined) {
  return value ? value.replace(/\D+/g, "") : "";
}

function toIsoFromUnixTimestamp(value: string | undefined) {
  if (!value) return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp * 1000).toISOString();
}

function mapHistoryStatusToDirectStatus(status: string | undefined) {
  const normalizedStatus = (status ?? "").toUpperCase();
  if (normalizedStatus === "READ" || normalizedStatus === "PLAYED") {
    return "read" as const;
  }
  if (normalizedStatus === "DELIVERED") {
    return "delivered" as const;
  }
  if (normalizedStatus === "ERROR") {
    return "failed" as const;
  }
  return "sent" as const;
}

function resolveDirectMessageContent(message: WebhookInboundMessage): ResolvedDirectMessageContent {
  let type: DirectMessageType = "text";
  const allowedTypes = new Set<DirectMessageType>([
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
  const rawType = message.type ?? "text";
  if (allowedTypes.has(rawType as DirectMessageType)) {
    type = rawType as DirectMessageType;
  }

  let body = "";
  let buttonPayload = "";
  let isHistoryMediaPlaceholder = false;

  if (message.type === "text") {
    body = message.text?.body ?? "";
  } else if (message.type === "reaction") {
    body = message.reaction?.emoji ?? "";
  } else if (message.type === "image") {
    body = message.image?.id ?? "";
  } else if (message.type === "audio") {
    body = message.audio?.id ?? "";
  } else if (message.type === "video") {
    body = message.video?.id ?? "";
  } else if (message.type === "document") {
    body = message.document?.id ?? "";
  } else if (message.type === "sticker") {
    body = message.sticker?.id ?? "";
  } else if (message.type === "location") {
    body =
      message.location?.name || `${message.location?.latitude}, ${message.location?.longitude}`;
  } else if (message.type === "contacts") {
    body =
      message.contacts?.[0]?.name?.formatted_name ||
      message.contacts?.[0]?.phones?.[0]?.phone ||
      "Contato";
  } else if (message.type === "button") {
    body = message.button?.text ?? "[Botão]";
    buttonPayload = message.button?.payload ?? "";
  } else if (message.type === "interactive") {
    body =
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      "[Interação recebida]";
    buttonPayload =
      message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? "";
  } else if (message.type === "media_placeholder") {
    body = "[Mídia histórica sincronizada]";
    type = "text";
    isHistoryMediaPlaceholder = true;
  } else {
    body = `[Mensagem de tipo ${message.type} recebida]`;
    type = "text";
  }

  return { type, body, buttonPayload, isHistoryMediaPlaceholder };
}

function resolveHistoryDirection(
  message: WebhookHistoryMessage,
  businessPhoneDigits: string,
  contactPhone: string,
): DirectMessageDirection {
  const fromDigits = normalizePhoneDigits(message.from);
  if (businessPhoneDigits && fromDigits && fromDigits === businessPhoneDigits) {
    return "outgoing";
  }
  if (contactPhone && fromDigits && fromDigits === contactPhone) {
    return "incoming";
  }
  return "incoming";
}

async function ensureWhatsAppContact(
  options: EnsureWhatsAppContactOptions,
): Promise<EnsureWhatsAppContactResult> {
  const {
    userId,
    phoneDigits,
    contactName,
    source,
    markUnread = false,
    phoneNumberId,
    displayPhoneNumber,
    waId,
    extraCustomFields,
  } = options;

  const { data } = await dbAdmin
    .from("contacts")
    .select("id, name, custom_fields, chat_status")
    .eq("user_id", userId)
    .eq("phone_e164", phoneDigits)
    .maybeSingle();

  const existingContact = (data ?? null) as ContactLookupRow | null;
  const parsedCustomFields = parseJsonObject(existingContact?.custom_fields);
  const nextCustomFields: JsonObject = parsedCustomFields ? { ...parsedCustomFields } : {};

  if (waId) nextCustomFields.wa_id = waId;
  if (phoneNumberId) nextCustomFields.phone_number_id = phoneNumberId;
  if (displayPhoneNumber) nextCustomFields.display_phone_number = displayPhoneNumber;
  if (extraCustomFields) {
    for (const [key, value] of Object.entries(extraCustomFields)) {
      nextCustomFields[key] = value;
    }
  }

  const nextChatStatus =
    markUnread &&
    (!existingContact || !existingContact.chat_status || existingContact.chat_status === "fechado")
      ? "aguardando"
      : null;

  const contactPayload = {
    name: contactName || existingContact?.name || undefined,
    source: source ?? undefined,
    is_unread: markUnread ? true : undefined,
    chat_status: nextChatStatus ?? undefined,
    custom_fields: Object.keys(nextCustomFields).length > 0 ? nextCustomFields : undefined,
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

  const { data: refreshedContact } = await dbAdmin
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("phone_e164", phoneDigits)
    .maybeSingle();

  if (markUnread && nextChatStatus && refreshedContact?.id) {
    const { startChatSession } = await import("@/lib/chat-sessions.functions");
    await startChatSession(userId, refreshedContact.id, "aguardando");
  }

  return {
    existingContact,
    contactId: refreshedContact?.id ?? existingContact?.id ?? null,
    nextChatStatus,
  };
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

export async function processStatusUpdate(value: WebhookValue | undefined, userId: string) {
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

export async function processInboundMessages(value: WebhookValue | undefined, userId: string) {
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

export async function processInboundDirectMessages(value: WebhookValue | undefined, userId: string) {
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
    const phoneDigits = normalizePhoneDigits(from);


    const contactName = waIdToName.get(phoneDigits) || "";
    let contactResult: EnsureWhatsAppContactResult | null = null;

    try {
      contactResult = await ensureWhatsAppContact({
        userId,
        phoneDigits,
        contactName,
        source: "whatsapp_inbound",
        markUnread: true,
        phoneNumberId,
        displayPhoneNumber,
        waId: m.from ?? phoneDigits,
      });
    } catch (error: unknown) {
      throw error;
    }


    const resolvedContent = resolveDirectMessageContent(m);
    let type = resolvedContent.type;
    let body = resolvedContent.body;
    let buttonPayload = resolvedContent.buttonPayload;
    if (m.type === "interactive") {
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

    try {
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
    } catch (error: unknown) {
      throw error;
    }


    // 🚀 Chama o motor do BotFlow para processar essa mensagem
    if (phoneNumberId && body) {
      await processBotFlow(body, phoneDigits, phoneNumberId, userId, buttonPayload);
    }
  }
}

export async function processTemplateStatusUpdate(value: WebhookValue | undefined, userId: string) {
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

export async function processTemplateCategoryUpdate(value: WebhookValue | undefined, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const newCategory = value?.new_category as string | undefined;
  if (!metaId || !newCategory) return;
  await dbAdmin
    .from("templates")
    .update({ category: newCategory, synced_at: new Date().toISOString() })
    .eq("meta_template_id", metaId)
    .eq("user_id", userId);
}

export async function processStateSync(value: WebhookValue | undefined, userId: string) {
  const stateSyncItems = value?.state_sync ?? [];
  const phoneNumberId = value?.metadata?.phone_number_id
    ? String(value.metadata.phone_number_id)
    : null;
  const displayPhoneNumber = value?.metadata?.display_phone_number
    ? String(value.metadata.display_phone_number)
    : null;

  for (const item of stateSyncItems) {
    if (item.type !== "contact") continue;

    const phoneDigits = normalizePhoneDigits(item.contact?.phone_number);
    if (!phoneDigits) continue;

    const timestamp = item.metadata?.timestamp ?? null;
    const action = item.action ? String(item.action).toLowerCase() : "update";
    const contactName = item.contact?.full_name || item.contact?.first_name || null;
    const extraCustomFields: JsonObject = {
      coexistence_last_contact_action: action,
    };
    if (timestamp) extraCustomFields.coexistence_last_contact_sync_at = timestamp;

    if (action === "remove") {
      const { data } = await dbAdmin
        .from("contacts")
        .select("id, custom_fields")
        .eq("user_id", userId)
        .eq("phone_e164", phoneDigits)
        .maybeSingle();

      if (!data?.id) continue;

      const parsedCustomFields = parseJsonObject((data as ContactLookupRow).custom_fields);
      const nextCustomFields: JsonObject = parsedCustomFields ? { ...parsedCustomFields } : {};
      for (const [key, entry] of Object.entries(extraCustomFields)) {
        nextCustomFields[key] = entry;
      }

      await dbAdmin.from("contacts").update({ custom_fields: nextCustomFields }).eq("id", data.id);
      continue;
    }

    await ensureWhatsAppContact({
      userId,
      phoneDigits,
      contactName,
      source: "whatsapp_contact_sync",
      markUnread: false,
      phoneNumberId,
      displayPhoneNumber,
      waId: phoneDigits,
      extraCustomFields,
    });
  }
}

export async function processHistorySync(value: WebhookValue | undefined, userId: string) {
  const historyItems = value?.history ?? [];
  const phoneNumberId = value?.metadata?.phone_number_id
    ? String(value.metadata.phone_number_id)
    : null;
  const displayPhoneNumber = value?.metadata?.display_phone_number
    ? String(value.metadata.display_phone_number)
    : null;
  const businessPhoneDigits = normalizePhoneDigits(displayPhoneNumber);

  for (const historyItem of historyItems) {
    for (const error of historyItem.errors ?? []) {
      if (error.code === 2593109) {
        logInfo("Sincronização de histórico recusada pelo negócio", {
          userId,
          phoneNumberId,
          message: error.message ?? error.title ?? "History sync disabled by business",
        });
      }
    }

    for (const thread of historyItem.threads ?? []) {
      const contactPhone = normalizePhoneDigits(thread.id);
      if (!contactPhone) continue;

      await ensureWhatsAppContact({
        userId,
        phoneDigits: contactPhone,
        source: "whatsapp_history_sync",
        markUnread: false,
        phoneNumberId,
        displayPhoneNumber,
        waId: contactPhone,
        extraCustomFields: {
          coexistence_history_sync: true,
        },
      });

      for (const message of thread.messages ?? []) {
        const waMessageId = normalizeWaMessageId(message.id);
        if (!waMessageId) continue;

        const direction = resolveHistoryDirection(message, businessPhoneDigits, contactPhone);
        const resolvedContent = resolveDirectMessageContent(message);
        const replyToMessageId = message.context?.message_id ?? null;
        const createdAt = toIsoFromUnixTimestamp(message.timestamp);
        const status = mapHistoryStatusToDirectStatus(message.history_context?.status);

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
          contact_phone: contactPhone,
          direction,
          type: resolvedContent.type,
          body: resolvedContent.body,
          wa_message_id: waMessageId,
          status,
          reply_to_message_id: replyToMessageId,
          channel: "whatsapp",
          provider_account_id: phoneNumberId,
          metadata: {
            source: "history",
            history_context: message.history_context ?? null,
            history_metadata: historyItem.metadata ?? null,
            message,
            metadata: value?.metadata ?? null,
            history_media_placeholder: resolvedContent.isHistoryMediaPlaceholder,
          },
          raw_payload: value ?? null,
          created_at: createdAt ?? undefined,
        });
      }
    }
  }

  const historyMessages = value?.messages ?? [];
  for (const message of historyMessages) {
    const waMessageId = normalizeWaMessageId(message.id);
    if (!waMessageId) continue;

    const resolvedContent = resolveDirectMessageContent(message);
    const createdAt = toIsoFromUnixTimestamp(message.timestamp);

    const { data: existingMessage } = await dbAdmin
      .from("direct_messages")
      .select("id, contact_phone")
      .eq("user_id", userId)
      .eq("wa_message_id", waMessageId)
      .maybeSingle();

    const inferredContactPhone = existingMessage?.contact_phone
      ? String(existingMessage.contact_phone)
      : (() => {
          const fromDigits = normalizePhoneDigits(message.from);
          const toDigits = normalizePhoneDigits(message.to);
          if (fromDigits && fromDigits !== businessPhoneDigits) return fromDigits;
          if (toDigits && toDigits !== businessPhoneDigits) return toDigits;
          return "";
        })();

    if (!inferredContactPhone) continue;

    await ensureWhatsAppContact({
      userId,
      phoneDigits: inferredContactPhone,
      source: "whatsapp_history_sync",
      markUnread: false,
      phoneNumberId,
      displayPhoneNumber,
      waId: inferredContactPhone,
      extraCustomFields: {
        coexistence_history_sync: true,
      },
    });

    const direction =
      normalizePhoneDigits(message.from) === businessPhoneDigits ? "outgoing" : "incoming";

    if (existingMessage?.id) {
      await dbAdmin
        .from("direct_messages")
        .update({
          type: resolvedContent.type,
          body: resolvedContent.body,
          provider_account_id: phoneNumberId,
          metadata: {
            source: "history",
            message,
            metadata: value?.metadata ?? null,
            history_media_placeholder: false,
          },
          raw_payload: value ?? null,
          created_at: createdAt ?? undefined,
        })
        .eq("id", existingMessage.id);
      continue;
    }

    await dbAdmin.from("direct_messages").insert({
      id: randomUUID(),
      user_id: userId,
      contact_phone: inferredContactPhone,
      direction,
      type: resolvedContent.type,
      body: resolvedContent.body,
      wa_message_id: waMessageId,
      status: "sent",
      channel: "whatsapp",
      provider_account_id: phoneNumberId,
      metadata: {
        source: "history",
        message,
        metadata: value?.metadata ?? null,
        history_media_placeholder: false,
      },
      raw_payload: value ?? null,
      created_at: createdAt ?? undefined,
    });
  }
}

export async function processMessageEchoes(value: WebhookValue | undefined, userId: string) {
  const messageEchoes = value?.message_echoes ?? [];
  const phoneNumberId = value?.metadata?.phone_number_id
    ? String(value.metadata.phone_number_id)
    : null;
  const displayPhoneNumber = value?.metadata?.display_phone_number
    ? String(value.metadata.display_phone_number)
    : null;

  for (const message of messageEchoes) {
    const contactPhone = normalizePhoneDigits(message.to);
    if (!contactPhone) continue;

    await ensureWhatsAppContact({
      userId,
      phoneDigits: contactPhone,
      source: "whatsapp_message_echo",
      markUnread: false,
      phoneNumberId,
      displayPhoneNumber,
      waId: contactPhone,
      extraCustomFields: {
        coexistence_echo_enabled: true,
      },
    });

    const waMessageId = normalizeWaMessageId(message.id);
    if (!waMessageId) continue;

    const { data: existingMessage } = await dbAdmin
      .from("direct_messages")
      .select("id")
      .eq("user_id", userId)
      .eq("wa_message_id", waMessageId)
      .maybeSingle();

    if (existingMessage?.id) {
      continue;
    }

    const resolvedContent = resolveDirectMessageContent(message);
    const createdAt = toIsoFromUnixTimestamp(message.timestamp);

    await dbAdmin.from("direct_messages").insert({
      id: randomUUID(),
      user_id: userId,
      contact_phone: contactPhone,
      direction: "outgoing",
      type: resolvedContent.type,
      body: resolvedContent.body,
      wa_message_id: waMessageId,
      status: "sent",
      channel: "whatsapp",
      provider_account_id: phoneNumberId,
      metadata: {
        source: "smb_message_echoes",
        message,
        metadata: value?.metadata ?? null,
      },
      raw_payload: value ?? null,
      created_at: createdAt ?? undefined,
    });
  }
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



export async function processAccountUpdate(value: WebhookValue | undefined, userId: string) {
  const event = value?.event;
  if (!event) return;

  logInfo("Recebido account_update webhook", { userId, event });

  if (event === "ACCOUNT_OFFBOARDED") {
    // O cliente desconectou o app ou trocou de celular.
    // Campanhas devem falhar ou ser pausadas, mas mantemos as credenciais
    // pois o ACCOUNT_RECONNECTED pode chegar a qualquer momento.
    logInfo("Conta WABA desconectada (ACCOUNT_OFFBOARDED)", { userId });
  } else if (event === "ACCOUNT_RECONNECTED") {
    // O cliente concluiu a reinstalação do app no novo aparelho e manteve o opt-in
    logInfo("Conta WABA reconectada (ACCOUNT_RECONNECTED)", { userId });
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

        // Responde rápido para a Meta e empurra o payload para o Redis BullMQ
        await webhookQueue.add("meta-event", {
          entry: payload.entry,
          matchedUserId,
          evRowId: evRow?.id ?? null,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
