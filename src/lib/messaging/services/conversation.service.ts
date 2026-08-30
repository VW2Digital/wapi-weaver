"use server";

import { randomUUID } from "crypto";
import db, { transaction } from "@/lib/db";

export interface EnsureConversationOptions {
  tenantId: string;
  userId: string;
  contactId: string;
  channelConnectionId?: string | null;
  status?: string;
}

export interface EnsureConversationResult {
  sessionId: string;
  isNew: boolean;
}

export async function ensureConversation(
  options: EnsureConversationOptions,
): Promise<EnsureConversationResult> {
  const { tenantId, userId, contactId, channelConnectionId, status = "aguardando" } = options;

  return transaction(async (conn) => {
    // Find any existing conversation for this contact (legacy or v3).
    const [rows] = await conn.execute(
      `SELECT id, channel_connection_id FROM chat_sessions
       WHERE tenant_id = ? AND user_id = ? AND contact_id = ?
       ORDER BY started_at DESC
       LIMIT 1
       FOR UPDATE`,
      [tenantId, userId, contactId],
    );

    const existing = (rows as Array<{ id: string; channel_connection_id: string | null }>)?.[0];
    if (existing?.id) {
      // If a V3 channel is known, make sure it matches.
      if (channelConnectionId) {
        if (existing.channel_connection_id && existing.channel_connection_id !== channelConnectionId) {
          throw new Error(
            `Conversation channel mismatch: contact ${contactId} already linked to ${existing.channel_connection_id}, requested ${channelConnectionId}`,
          );
        }
        if (!existing.channel_connection_id) {
          await conn.execute(
            `UPDATE chat_sessions
             SET channel_connection_id = ?
             WHERE id = ?`,
            [channelConnectionId, existing.id],
          );
        }
      }
      return { sessionId: existing.id, isNew: false };
    }

    const sessionId = randomUUID();
    await conn.execute(
      `INSERT INTO chat_sessions (
         id, tenant_id, user_id, contact_id, channel_connection_id, status, started_at
       ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [sessionId, tenantId, userId, contactId, channelConnectionId ?? null, status],
    );

    return { sessionId, isNew: true };
  });
}

export async function getConversationByContact(
  tenantId: string,
  contactId: string,
): Promise<{ id: string } | null> {
  const [rows] = (await db.query(
    `SELECT id FROM chat_sessions
     WHERE tenant_id = ? AND contact_id = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    [tenantId, contactId],
  )) as Array<{ id: string }>[];

  return rows?.[0] ?? null;
}
