"use server";

import { randomUUID } from "crypto";
import db from "@/lib/db";
import { ensureContact } from "@/lib/messaging/services/contact-identity.service";
import { ensureConversation } from "@/lib/messaging/services/conversation.service";
import { saveMessage } from "@/lib/messaging/services/message.service";
import { triggerBotForMessage } from "@/lib/messaging/services/bot-trigger.service";
import type { WebchatSession } from "./session.service";

const MAX_TEXT_LENGTH = 4000;

function isValidClientMessageId(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function sanitizeText(text: string): string {
  return text.trim().slice(0, MAX_TEXT_LENGTH);
}

export interface InboundResult {
  messageId: string;
  conversationId: string;
  clientMessageId: string;
  duplicate: boolean;
  botTriggered: boolean;
}

export async function handleWebchatInboundMessage(
  session: WebchatSession,
  clientMessageId: string,
  text: string,
): Promise<InboundResult> {
  if (!clientMessageId || !isValidClientMessageId(clientMessageId)) {
    throw Object.assign(new Error("clientMessageId is required"), { statusCode: 400 });
  }

  const cleanText = sanitizeText(text);
  if (!cleanText) {
    throw Object.assign(new Error("Message text is empty"), { statusCode: 400 });
  }

  const tenantId = session.tenantId;
  const userId = session.tenantId;
  const visitorId = session.visitorId;
  const channelConnectionId = session.channelConnectionId;
  const publicId = session.widgetId; // caller resolves publicId

  const identity = {
    externalId: visitorId,
    name: null as string | null,
    avatarUrl: null,
    phoneE164: null,
    metadata: null,
  };

  const contactResult = await ensureContact({
    tenantId,
    userId,
    provider: "webchat",
    identity,
    phoneE164: null,
    source: "webchat_inbound",
    markUnread: true,
    metadata: null,
  });

  const conversation = await ensureConversation({
    tenantId,
    userId,
    contactId: contactResult.contactId,
    channelConnectionId,
    status: "aguardando",
  });

  await db.query(
    `UPDATE webchat_sessions
     SET conversation_id = ?, updated_at = NOW()
     WHERE id = ?`,
    [conversation.sessionId, session.id],
  );

  const contactPhone = `wc_${visitorId}`;

  const canonicalMessage = {
    providerMessageId: clientMessageId,
    direction: "incoming" as const,
    type: "text" as const,
    body: cleanText,
    sender: identity,
    recipient: { externalId: publicId, name: null, phoneE164: null },
  };

  const saved = await saveMessage({
    tenantId,
    userId,
    contactId: contactResult.contactId,
    conversationId: conversation.sessionId,
    contactPhone,
    provider: "webchat",
    channelResourceId: publicId,
    channelConnectionId,
    message: canonicalMessage,
    rawPayload: { clientMessageId, text: cleanText },
    status: null,
    clientMessageId,
  });

  let botTriggered = false;
  if (saved.isNew) {
    try {
      await triggerBotForMessage({
        userId,
        phoneNumberId: channelConnectionId,
        contactPhone,
        message: canonicalMessage,
        provider: "webchat",
        messageId: saved.messageId,
        conversationId: conversation.sessionId,
      });
      botTriggered = true;
    } catch (err) {
      console.error("[WebChat Inbound] bot trigger failed, continuing", err);
    }
  }

  return {
    messageId: saved.messageId,
    conversationId: conversation.sessionId,
    clientMessageId,
    duplicate: !saved.isNew,
    botTriggered,
  };
}
