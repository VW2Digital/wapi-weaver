"use server";

import db from "@/lib/db";
import type { MessageStatus } from "../types";

const STATUS_ORDER = ["queued", "sent", "delivered", "read"];

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

  const nextTimestamp = (timestamp
    ? new Date(timestamp)
    : new Date()
  ).toISOString().slice(0, 19).replace("T", " ");

  const setFields: string[] = ["status = ?"];
  const params: (string | null | unknown)[] = [status];

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

  // Never regress state. The FIELD comparison uses the canonical status order.
  params.push(userId);
  params.push(providerMessageId, providerMessageId);
  params.push(status);

  const sql = `UPDATE direct_messages
     SET ${setFields.join(", ")}
     WHERE user_id = ?
       AND (wa_message_id = ? OR provider_message_id = ?)
       AND (
         status IS NULL
         OR status = 'failed'
         OR FIELD(status, 'queued', 'sent', 'delivered', 'read') < FIELD(?, 'queued', 'sent', 'delivered', 'read')
       )`;
  const result = await db.query<{ affectedRows: number }>(sql, params);

  const updated = (result?.affectedRows ?? 0) > 0;

  const [rows] = (await db.query(
    `SELECT id, contact_phone FROM direct_messages
     WHERE user_id = ? AND (wa_message_id = ? OR provider_message_id = ?)
     LIMIT 1`,
    [userId, providerMessageId, providerMessageId],
  )) as Array<{ id: string; contact_phone: string }>[];

  // Campaign messages may also receive status updates for the same wa_message_id
  await updateCampaignMessageStatus(userId, providerMessageId, status, timestamp ?? null, errors);

  return {
    messageId: rows?.[0]?.id ?? null,
    contactPhone: rows?.[0]?.contact_phone ?? null,
    updated,
  };
}

async function updateCampaignMessageStatus(
  userId: string,
  waMessageId: string,
  status: MessageStatus,
  timestamp: string | null,
  errors: unknown,
): Promise<void> {
  const allowedCampaignStatuses = ["pending", "sending", "sent", "delivered", "read", "failed"];
  if (!allowedCampaignStatuses.includes(status)) return;

  const nextTimestamp = timestamp
    ? new Date(timestamp).toISOString().slice(0, 19).replace("T", " ")
    : null;

  const setFields: string[] = ["status = ?"];
  const params: (string | null)[] = [status];

  if (status === "sent" && nextTimestamp) {
    setFields.push("sent_at = ?");
    params.push(nextTimestamp);
  } else if (status === "delivered" && nextTimestamp) {
    setFields.push("delivered_at = ?");
    params.push(nextTimestamp);
  } else if (status === "read" && nextTimestamp) {
    setFields.push("read_at = ?");
    params.push(nextTimestamp);
  } else if (status === "failed" && nextTimestamp) {
    setFields.push("failed_at = ?");
    params.push(nextTimestamp);
    if (errors) {
      setFields.push("error = ?");
      params.push(JSON.stringify(errors));
    }
  }

  // Never regress state. The FIELD comparison uses the canonical status order.
  params.push(userId);
  params.push(waMessageId);
  params.push(status);

  await db.query(
    `UPDATE campaign_messages
     SET ${setFields.join(", ")}
     WHERE user_id = ?
       AND wa_message_id = ?
       AND (
         status IS NULL
         OR status = 'failed'
         OR FIELD(status, 'pending', 'sending', 'sent', 'delivered', 'read') < FIELD(?, 'pending', 'sending', 'sent', 'delivered', 'read')
       )`,
    params,
  );
}
