"use server";

import type {
  CanonicalAttachment,
  CanonicalEvent,
  CanonicalMessage,
  CanonicalStatusUpdate,
  EventType,
  MessageDirection,
  MessageType,
  NormalizationResult,
} from "../types";
import {
  BaseMessagingAdapter,
  buildAttachment,
  buildEventBase,
  buildIdentity,
  logAdapterError,
  normalizePhoneDigits,
  normalizeProviderMessageId,
  resolveMessageDirection,
  resolveMessageStatus,
  resolveMessageType,
  toIsoFromUnixTimestamp,
} from "./base.adapter";

export type WhatsAppRawPayload = {
  object?: string;
  entry?: WhatsAppEntry[];
};

type WhatsAppEntry = {
  id?: string;
  changes?: WhatsAppChange[];
};

type WhatsAppChange = {
  value?: WhatsAppValue;
  field?: string;
};

type WhatsAppValue = {
  messaging_product?: string;
  metadata?: {
    phone_number_id?: string;
    display_phone_number?: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppStatus[];
  message_echoes?: WhatsAppInboundMessage[];
  calls?: WhatsAppCall[];
  state_sync?: unknown[];
  history?: unknown[];
  event?: string;
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  new_category?: string;
};

type WhatsAppContact = {
  wa_id?: string;
  profile?: { name?: string };
};

type WhatsAppInboundMessage = {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
  group_id?: string | null;
  group_name?: string | null;
  recipient_type?: string | null;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string };
    nfm_reply?: { name?: string; response_json?: string };
  };
  reaction?: { message_id?: string; emoji?: string };
  image?: { id?: string; caption?: string; mime_type?: string; sha256?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string; sha256?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string; sha256?: string };
  sticker?: { id?: string; mime_type?: string; sha256?: string };
  location?: { name?: string; latitude?: number; longitude?: number };
  contacts?: WhatsAppContactCard[];
  context?: { id?: string | null; message_id?: string | null };
};

type WhatsAppContactCard = {
  name?: { formatted_name?: string };
  phones?: Array<{ phone?: string }>;
};

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: unknown;
  pricing?: {
    billable?: boolean | null;
    category?: string | null;
    pricing_model?: string | null;
  };
  conversation?: { id?: string | null; origin?: { type?: string | null } };
};

type WhatsAppCall = {
  id?: string;
  direction?: string;
  event?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  from_user_id?: string;
  session?: { sdp?: string; sdp_type?: string };
};

function resolveMessageContent(
  message: WhatsAppInboundMessage,
): {
  type: MessageType;
  body: string;
  buttonPayload: string;
  attachments: CanonicalAttachment[];
} {
  const type = resolveMessageType(message.type);
  let body = "";
  let buttonPayload = "";
  const attachments: CanonicalAttachment[] = [];

  switch (message.type) {
    case "text":
      body = message.text?.body ?? "";
      break;
    case "reaction":
      body = message.reaction?.emoji ?? "";
      break;
    case "image":
      body = message.image?.caption || "[Imagem]";
      attachments.push(buildAttachment("image", message.image ?? undefined));
      break;
    case "audio":
      body = "[Áudio]";
      attachments.push(buildAttachment("audio", message.audio ?? undefined));
      break;
    case "video":
      body = message.video?.caption || "[Vídeo]";
      attachments.push(buildAttachment("video", message.video ?? undefined));
      break;
    case "document":
      body = message.document?.filename || message.document?.caption || "[Documento]";
      attachments.push(buildAttachment("document", message.document ?? undefined));
      break;
    case "sticker":
      body = "[Figurinha]";
      attachments.push(buildAttachment("sticker", message.sticker ?? undefined));
      break;
    case "location":
      body = message.location?.name || `${message.location?.latitude}, ${message.location?.longitude}`;
      break;
    case "contacts":
      body =
        message.contacts?.[0]?.name?.formatted_name ||
        message.contacts?.[0]?.phones?.[0]?.phone ||
        "Contato";
      break;
    case "button":
      body = message.button?.text ?? "[Botão]";
      buttonPayload = message.button?.payload ?? "";
      break;
    case "interactive":
      if (message.interactive?.type === "nfm_reply" && message.interactive.nfm_reply?.name === "flow") {
        body = "[Formulário Flow Enviado]";
        buttonPayload = "flow";
      } else {
        body =
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "[Interação recebida]";
        buttonPayload =
          message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? "";
      }
      break;
    default:
      body = `[Mensagem de tipo ${message.type} recebida]`;
  }

  return { type, body, buttonPayload, attachments };
}

function resolveHistoryDirection(
  message: WhatsAppInboundMessage,
  businessPhoneDigits: string,
): MessageDirection {
  const fromDigits = normalizePhoneDigits(message.from);
  if (businessPhoneDigits && fromDigits && fromDigits === businessPhoneDigits) return "outgoing";
  return "incoming";
}

export class WhatsAppAdapter extends BaseMessagingAdapter {
  readonly provider = "whatsapp" as const;

  extractChannelResourceIds(rawPayload: unknown): string[] {
    const payload = rawPayload as WhatsAppRawPayload;
    const ids = new Set<string>();
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const phoneNumberId = change?.value?.metadata?.phone_number_id;
        if (phoneNumberId) ids.add(String(phoneNumberId));
      }
    }
    return Array.from(ids);
  }

  normalize(rawPayload: unknown): NormalizationResult {
    const payload = rawPayload as WhatsAppRawPayload;
    const events: CanonicalEvent[] = [];
    const reasons: string[] = [];

    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id
          ? String(value.metadata.phone_number_id)
          : "";
        const displayPhoneNumber = value.metadata?.display_phone_number ?? "";
        const businessPhoneDigits = normalizePhoneDigits(displayPhoneNumber);
        const contactNameByWaId = new Map<string, string>();
        for (const c of value.contacts ?? []) {
          if (c.wa_id) {
            contactNameByWaId.set(String(c.wa_id), c.profile?.name ?? "");
            contactNameByWaId.set(normalizePhoneDigits(c.wa_id), c.profile?.name ?? "");
          }
        }

        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            const waMessageId = normalizeProviderMessageId(message.id);
            if (!waMessageId || !message.from) {
              reasons.push("missing message id or sender");
              continue;
            }
            const { type, body, buttonPayload, attachments } = resolveMessageContent(message);
            const replyToMessageId =
              message.type === "reaction"
                ? message.reaction?.message_id || message.context?.id || message.context?.message_id || null
                : message.context?.id || message.context?.message_id || null;

            const senderPhone = normalizePhoneDigits(message.from);
            const contactName = contactNameByWaId.get(senderPhone) || "";

            const canonicalMessage: CanonicalMessage = {
              providerMessageId: waMessageId,
              direction: message.recipient_type === "group" ? "incoming" : "incoming",
              type,
              body,
              replyToMessageId: replyToMessageId ?? null,
              buttonPayload,
              attachments,
              providerTimestamp: message.timestamp ? Number(message.timestamp) : null,
              sender: buildIdentity(message.from, {
                name: contactName,
                phoneE164: senderPhone,
              }),
              recipient: buildIdentity(phoneNumberId, {
                phoneE164: businessPhoneDigits,
              }),
              externalGroupId: message.group_id ?? null,
              senderWaId: message.from,
              senderName: contactName,
              raw: message,
            };

            events.push(
              buildEventBase(
                this.provider,
                "", // tenantId resolved later by TenantResolutionService
                "message.received",
                waMessageId,
                phoneNumberId,
                canonicalMessage,
                payload,
                { providerTimestamp: message.timestamp ? Number(message.timestamp) : null },
              ),
            );
          }
        }

        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            const waMessageId = normalizeProviderMessageId(status.id);
            const resolvedStatus = resolveMessageStatus(status.status);
            if (!waMessageId || !resolvedStatus) {
              reasons.push(`invalid status: ${status.status}`);
              continue;
            }
            const statusUpdate: CanonicalStatusUpdate = {
              providerMessageId: waMessageId,
              status: resolvedStatus,
              providerTimestamp: status.timestamp ? Number(status.timestamp) : null,
              conversationId: status.conversation?.id ?? null,
              conversationOrigin: status.conversation?.origin?.type ?? null,
              pricing: {
                billable: status.pricing?.billable ?? null,
                category: status.pricing?.category ?? null,
                model: status.pricing?.pricing_model ?? null,
              },
              errors: status.errors ?? null,
              raw: status,
            };
            events.push(
              buildEventBase(
                this.provider,
                "",
                "message.status",
                `${waMessageId}:${resolvedStatus}`,
                phoneNumberId,
                statusUpdate,
                payload,
                { providerTimestamp: status.timestamp ? Number(status.timestamp) : null },
              ),
            );
          }
        }

        if (value.message_echoes && value.message_echoes.length > 0) {
          for (const message of value.message_echoes) {
            const waMessageId = normalizeProviderMessageId(message.id);
            const toPhone = normalizePhoneDigits(message.to);
            if (!waMessageId || !toPhone) {
              reasons.push("missing echo message id or recipient");
              continue;
            }
            const { type, body, attachments } = resolveMessageContent(message);
            const canonicalMessage: CanonicalMessage = {
              providerMessageId: waMessageId,
              direction: "outgoing",
              type,
              body,
              attachments,
              providerTimestamp: message.timestamp ? Number(message.timestamp) : null,
              sender: buildIdentity(phoneNumberId, { phoneE164: businessPhoneDigits }),
              recipient: buildIdentity(message.to ?? toPhone, { phoneE164: toPhone }),
              raw: message,
            };
            events.push(
              buildEventBase(
                this.provider,
                "",
                "message.echo",
                waMessageId,
                phoneNumberId,
                canonicalMessage,
                payload,
                { providerTimestamp: message.timestamp ? Number(message.timestamp) : null },
              ),
            );
          }
        }

        if (value.event) {
          const externalEventId = `account:${value.event}:${entry.id ?? Date.now()}`;
          events.push(
            buildEventBase(
              this.provider,
              "",
              "account.update",
              externalEventId,
              phoneNumberId,
              { event: value.event },
              payload,
            ),
          );
        }

        if (value.message_template_id && value.event) {
          const eventType = value.new_category ? "template.category" : "template.status";
          const externalEventId = `template:${value.message_template_id}:${value.event}`;
          events.push(
            buildEventBase(
              this.provider,
              "",
              eventType,
              externalEventId,
              phoneNumberId,
              {
                metaTemplateId: value.message_template_id,
                name: value.message_template_name,
                language: value.message_template_language,
                event: value.event,
                newCategory: value.new_category,
              },
              payload,
            ),
          );
        }

        if (value.calls && value.calls.length > 0) {
          for (const call of value.calls) {
            const externalEventId = call.id ? `call:${call.id}:${call.event}` : `call:${Date.now()}`;
            events.push(
              buildEventBase(
                this.provider,
                "",
                "call",
                externalEventId,
                phoneNumberId,
                call,
                payload,
                { providerTimestamp: call.timestamp ? Number(call.timestamp) : null },
              ),
            );
          }
        }
      }
    }

    return { events, diagnostics: { entryCount: payload?.entry?.length, ignoredCount: reasons.length, reasons } };
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
