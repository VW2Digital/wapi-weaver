"use server";

import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import db, { transaction } from "@/lib/db";
import type { CanonicalAttachment, CanonicalMessage, MessagingProvider } from "../types";

export interface SaveMessageOptions {
  tenantId: string;
  userId: string;
  contactId: string;
  conversationId?: string | null;
  contactPhone: string;
  provider: MessagingProvider;
  channelResourceId: string;
  channelConnectionId?: string | null;
  message: CanonicalMessage;
  rawPayload?: unknown;
  status?: "sent" | "delivered" | null;
  clientMessageId?: string | null;
}

export interface SaveMessageResult {
  messageId: string;
  isNew: boolean;
}

function buildMessageBody(message: CanonicalMessage): string {
  if (message.body) return message.body;
  if (message.attachments && message.attachments.length > 0) {
    const first = message.attachments[0];
    if (first.type === "image") return first.caption || "[Imagem]";
    if (first.type === "audio") return "[Áudio]";
    if (first.type === "video") return first.caption || "[Vídeo]";
    if (first.type === "document") return first.filename || first.caption || "[Documento]";
    if (first.type === "sticker") return "[Figurinha]";
  }
  return "[Mensagem]";
}

export async function saveMessage(options: SaveMessageOptions): Promise<SaveMessageResult> {
  const {
    tenantId,
    userId,
    contactId,
    conversationId,
    contactPhone,
    provider,
    channelResourceId,
    channelConnectionId,
    message,
    rawPayload = null,
    status = message.direction === "outgoing" ? "sent" : null,
    clientMessageId = null,
  } = options;

  const messageId = randomUUID();
  const body = buildMessageBody(message);

  const primaryAttachment = message.attachments?.[0];

  return transaction(async (conn) => {
    // Check for existing message first to avoid reliance on the unique key being present.
    const [existingRows] = await conn.execute(
      `SELECT id FROM direct_messages
       WHERE user_id = ? AND (wa_message_id = ? OR provider_message_id = ?)
       LIMIT 1`,
      [userId, message.providerMessageId, message.providerMessageId],
    );

    const existing = (existingRows as Array<{ id: string }>)?.[0];
    if (existing?.id) {
      return { messageId: existing.id, isNew: false };
    }

    try {
      const [insertResult] = await conn.execute(
        `INSERT INTO direct_messages (
           id, client_message_id, tenant_id, user_id, contact_phone, conversation_id, direction, type,
           body, wa_message_id, status, reply_to_message_id,
           channel, channel_connection_id, provider_message_id, provider_account_id,
           sender_wa_id, sender_name, external_group_id,
           metadata, raw_payload, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          messageId,
          clientMessageId,
          tenantId,
          userId,
          contactPhone,
          conversationId ?? null,
          message.direction,
          message.type,
          body,
          message.providerMessageId,
          status,
          message.replyToMessageId ?? null,
          provider,
          channelConnectionId ?? null,
          message.providerMessageId,
          channelResourceId,
          message.senderWaId ?? null,
          message.senderName ?? null,
          message.externalGroupId ?? null,
          JSON.stringify({
            attachments: message.attachments ?? [],
            buttonPayload: message.buttonPayload ?? null,
            primaryAttachment,
            raw: message.raw,
          }),
          rawPayload ? JSON.stringify(rawPayload) : null,
        ],
      );

      const result = insertResult as unknown as ResultSetHeader;
      return { messageId: result.affectedRows === 1 ? messageId : existing?.id ?? messageId, isNew: result.affectedRows === 1 };
    } catch (error: any) {
      // Race: another request inserted the same client_message_id / wa_message_id.
      if (error?.code === "ER_DUP_ENTRY") {
        const [raceRows] = await conn.execute(
          `SELECT id FROM direct_messages
           WHERE user_id = ? AND (wa_message_id = ? OR provider_message_id = ? OR client_message_id = ?)
           LIMIT 1`,
          [userId, message.providerMessageId, message.providerMessageId, clientMessageId],
        );
        const race = (raceRows as Array<{ id: string }>)?.[0];
        return { messageId: race?.id ?? messageId, isNew: false };
      }
      throw error;
    }
  });
}

export async function getMessageByProviderId(
  userId: string,
  providerMessageId: string,
): Promise<{ id: string; status: string | null } | null> {
  const [rows] = (await db.query(
    `SELECT id, status FROM direct_messages
     WHERE user_id = ? AND (wa_message_id = ? OR provider_message_id = ?)
     LIMIT 1`,
    [userId, providerMessageId, providerMessageId],
  )) as Array<{ id: string; status: string | null }>[];

  return rows?.[0] ?? null;
}
