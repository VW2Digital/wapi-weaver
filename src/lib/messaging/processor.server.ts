"use server";

import type { CanonicalEvent, CanonicalMessage, CanonicalStatusUpdate, MessagingProvider } from "./types";
import { getChannelConfig } from "./services/channel.service";
import { ensureContact } from "./services/contact-identity.service";
import { ensureConversation } from "./services/conversation.service";
import { saveMessage } from "./services/message.service";
import { updateMessageStatus } from "./services/status.service";
import {
  publishMessageReceived,
  publishMessageSent,
  publishMessageStatus,
} from "./services/realtime.service";
import { downloadMessageMedia } from "./services/media-download.service";
import { triggerBotForMessage } from "./services/bot-trigger.service";
import { normalizePhoneDigits } from "./adapters/base.adapter";

function getContactPhoneForIdentity(
  message: CanonicalMessage,
  provider: MessagingProvider,
): string {
  if (provider === "whatsapp") {
    return message.sender.phoneE164 || normalizePhoneDigits(message.sender.externalId);
  }
  if (provider === "instagram") {
    return `ig_${message.sender.externalId}`;
  }
  if (provider === "messenger") {
    return `fb_${message.sender.externalId}`;
  }
  if (provider === "webchat") {
    return `wc_${message.sender.externalId}`;
  }
  return message.sender.externalId;
}

export async function processCanonicalEvent(event: CanonicalEvent): Promise<void> {
  if (event.status !== "pending" && event.status !== "processing") {
    return;
  }

  if (!event.tenantId) {
    throw new Error(`Event ${event.id} has no tenantId`);
  }

  let channelConnectionId = event.channelConnectionId ?? null;

  if (!channelConnectionId) {
    const config = await getChannelConfig(
      event.provider,
      event.tenantId,
      event.channelResourceId,
    );
    if (!config) {
      throw new Error(`[messaging:processor] Channel config not resolved for provider=${event.provider} tenant=${event.tenantId} resource=${event.channelResourceId}. FAIL_CLOSED.`);
    }
    channelConnectionId = config.channelConnectionId ?? null;
  }

  const userId = event.userId || event.tenantId;

  switch (event.eventType) {
    case "message.received":
    case "message.echo": {
      const message = event.payload as CanonicalMessage;
      const contactPhone = getContactPhoneForIdentity(message, event.provider);
      const phoneE164 = event.provider === "webchat" ? null : contactPhone;
      const contactResult = await ensureContact({
        tenantId: event.tenantId,
        userId,
        provider: event.provider,
        identity: message.sender,
        phoneE164,
        source: `${event.provider}_${event.eventType === "message.echo" ? "echo" : "inbound"}`,
        markUnread: event.eventType === "message.received",
      });

      const conversation = await ensureConversation({
        tenantId: event.tenantId,
        userId,
        contactId: contactResult.contactId,
        channelConnectionId,
        status: "aguardando",
      });

      const saved = await saveMessage({
        tenantId: event.tenantId,
        userId,
        contactId: contactResult.contactId,
        conversationId: conversation.sessionId,
        contactPhone,
        provider: event.provider,
        channelResourceId: event.channelResourceId,
        channelConnectionId,
        message,
        rawPayload: event.rawPayload,
        status: event.eventType === "message.echo" ? "sent" : null,
      });

      if (saved.isNew) {
        if (event.eventType === "message.echo") {
          await publishMessageSent({
            tenantId: event.tenantId,
            contactPhone,
            messageId: saved.messageId,
            providerMessageId: message.providerMessageId,
          });
        } else {
          await publishMessageReceived({
            tenantId: event.tenantId,
            contactPhone,
            messageId: saved.messageId,
            providerMessageId: message.providerMessageId,
            provider: event.provider,
          });
        }

        // Download media asynchronously; do not block the processor on failure.
        downloadMessageMedia({
          tenantId: event.tenantId,
          messageId: saved.messageId,
          provider: event.provider,
          message,
          channelResourceId: event.channelResourceId,
        }).catch((error) => {
          console.error(`[messaging:processor] Media download failed for ${saved.messageId}`, error);
        });

        // Trigger bot flow for inbound messages.
        if (event.eventType === "message.received") {
          triggerBotForMessage({
            userId,
            phoneNumberId: event.channelResourceId,
            contactPhone,
            message,
            provider: event.provider,
            messageId: saved.messageId,
          }).catch((error) => {
            console.error(`[messaging:processor] Bot flow failed for ${saved.messageId}`, error);
          });
        }
      }
      break;
    }

    case "message.status": {
      const status = event.payload as CanonicalStatusUpdate;
      const update = await updateMessageStatus({
        tenantId: event.tenantId,
        userId,
        providerMessageId: status.providerMessageId,
        status: status.status,
        timestamp: status.providerTimestamp
          ? new Date(status.providerTimestamp * 1000).toISOString()
          : null,
        conversationId: status.conversationId,
        conversationOrigin: status.conversationOrigin,
        errors: status.errors,
      });

      if (update.updated && update.messageId && update.contactPhone) {
        await publishMessageStatus({
          tenantId: event.tenantId,
          contactPhone: update.contactPhone,
          messageId: update.messageId,
          providerMessageId: status.providerMessageId,
          status: status.status,
        });
      }
      break;
    }

    case "template.status":
    case "template.category":
    case "account.update":
    case "call":
    case "history.sync":
    case "state.sync":
    case "unknown":
      // Intentionally left for future phases or specific handlers.
      console.info(`[messaging:processor] Event type ${event.eventType} not yet processed`, {
        eventId: event.id,
      });
      break;

    default:
      throw new Error(`Unknown event type: ${(event as CanonicalEvent).eventType}`);
  }
}
