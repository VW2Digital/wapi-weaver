"use server";

import { randomUUID } from "crypto";
import db, { transaction } from "@/lib/db";

export interface EnsureConversationOptions {
  tenantId: string;
  userId: string;
  contactId: string;
  status?: string;
}

export interface EnsureConversationResult {
  sessionId: string;
  isNew: boolean;
}

/**
 * Garante uma chat_session para o contato.
 *
 * A tabela chat_sessions deveria possuir UNIQUE KEY (tenant_id, contact_id).
 * Enquanto isso não for aplicado (dados duplicados legados), usamos
 * SELECT + INSERT dentro de transaction. Isso ainda permite race conditions
 * sob alta concorrência; a unique key é a correção definitiva.
 */
export async function ensureConversation(
  options: EnsureConversationOptions,
): Promise<EnsureConversationResult> {
  const { tenantId, userId, contactId, status = "aguardando" } = options;

  return transaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT id FROM chat_sessions
       WHERE tenant_id = ? AND user_id = ? AND contact_id = ?
       ORDER BY started_at DESC
       LIMIT 1
       FOR UPDATE`,
      [tenantId, userId, contactId],
    );

    const existing = (rows as Array<{ id: string }>)?.[0];
    if (existing?.id) {
      return { sessionId: existing.id, isNew: false };
    }

    const sessionId = randomUUID();
    await conn.execute(
      `INSERT INTO chat_sessions (
         id, tenant_id, user_id, contact_id, status, started_at
       ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [sessionId, tenantId, userId, contactId, status],
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
