"use server";

import db from "@/lib/db";
import type { WebchatSession } from "./session.service";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface HistoryMessage {
  id: string;
  direction: string;
  type: string;
  body: string;
  status: string | null;
  providerMessageId: string | null;
  clientMessageId: string | null;
  createdAt: string;
}

export async function getWebchatHistory(
  session: WebchatSession,
  limit: number,
  before?: string | null,
): Promise<HistoryMessage[]> {
  if (!session.conversationId) return [];

  const resolvedLimit = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAX_LIMIT);

  let params: any[] = [session.tenantId, session.conversationId, resolvedLimit];
  let cursorClause = "";

  if (before) {
    cursorClause = "AND created_at < ?";
    params = [session.tenantId, session.conversationId, before, resolvedLimit];
  }

  const rows = (await db.query(
    `SELECT
       id,
       direction,
       type,
       body,
       status,
       provider_message_id,
       client_message_id,
       created_at
     FROM direct_messages
     WHERE tenant_id = ?
       AND conversation_id = ?
       ${cursorClause}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
  )) as any[];

  return rows.reverse().map((row) => ({
    id: row.id,
    direction: row.direction,
    type: row.type,
    body: row.body,
    status: row.status,
    providerMessageId: row.provider_message_id ?? null,
    clientMessageId: row.client_message_id ?? null,
    createdAt: row.created_at,
  }));
}
