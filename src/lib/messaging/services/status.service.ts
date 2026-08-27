"use server";

import db from "@/lib/db";
import type { MessageStatus } from "../types";

const STATUS_RANK: Record<MessageStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

export interface UpdateStatusOptions {
  tenantId: string;
  userId: string;
  providerMessageId: string;
  status: MessageStatus;
  timestamp?: string | null;
  conversationId?: string | null;
  conversationOrigin?: string | null;
  errors?: unknown;
}

export interface UpdateStatusResult {
  messageId: string | null;
  contactPhone: string | null;
  updated: boolean;
}

export async function updateMessageStatus(
  options: UpdateStatusOptions,
): Promise<UpdateStatusResult> {
  const {
    userId,
    providerMessageId,
    status,
    timestamp,
    conversationId,
    conversationOrigin,
    errors,
  } = options;

  const nextTimestamp = timestamp ?? new Date().toISOString();

  // Build dynamic SET clause based on status.
  const setFields: string[] = ["status = ?"];
  const params: (string | null)[] = [status];

  if (status === "delivered") {
    setFields.push("delivered_at = ?");
    params.push(nextTimestamp);
  } else if (status === "read") {
    setFields.push("read_at = ?");
    params.push(nextTimestamp);
  } else if (status === "failed") {
    setFields.push("failed_at = ?");
    params.push(nextTimestamp);
  }

  if (conversationId) {
    setFields.push("metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.conversation_id', ?)");
    params.push(conversationId);
  }

  if (conversationOrigin) {
    setFields.push("metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.conversation_origin', ?)");
    params.push(conversationOrigin);
  }

  if (errors) {
    setFields.push("metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.errors', ?)");
    params.push(JSON.stringify(errors));
  }

  // Status transition guard: never regress state. Failed is allowed to override
  // anything except delivered/read. Other statuses only advance.
  const transitionGuard =
    status === "failed"
      ? "(status IS NULL OR status NOT IN ('delivered', 'read'))"
      : "(status IS NULL OR (status != 'failed' AND FIELD(status, 'queued', 'sent', 'delivered', 'read') < ?))";

  if (status !== "failed") {
    params.push(String(STATUS_RANK[status]));
  }

  params.push(userId, providerMessageId, providerMessageId);

  const result = await db.query<{ affectedRows: number }>(
    `UPDATE direct_messages
     SET ${setFields.join(", ")}
     WHERE user_id = ?
       AND (wa_message_id = ? OR provider_message_id = ?)
       AND ${transitionGuard}`,
    params,
  );

  const updated = (result?.affectedRows ?? 0) > 0;

  const [rows] = (await db.query(
    `SELECT id, contact_phone FROM direct_messages
     WHERE user_id = ? AND (wa_message_id = ? OR provider_message_id = ?)
     LIMIT 1`,
    [userId, providerMessageId, providerMessageId],
  )) as Array<{ id: string; contact_phone: string }>[];

  return {
    messageId: rows?.[0]?.id ?? null,
    contactPhone: rows?.[0]?.contact_phone ?? null,
    updated,
  };
}
