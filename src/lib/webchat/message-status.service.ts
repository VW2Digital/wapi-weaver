"use server";

import db from "@/lib/db";
import { publishChatRealtimeEvent } from "@/lib/chat-realtime.server";
import type { WebchatSession } from "./session.service";

/**
 * WebChat message status ACKs.
 *
 * WebChat is the only provider where we control both ends (CRM backend and the
 * visitor's browser), so `delivered` and `read` are real acknowledgements sent
 * by the widget rather than inferred from an external provider webhook.
 *
 * Semantics:
 *   sent      -> outbound message persisted and accepted by the WebChat adapter
 *   delivered -> the visitor's browser actually received the message
 *   read      -> the message became visible to the visitor (widget open + tab visible)
 *
 * This service is intentionally WebChat-scoped: it never touches WhatsApp or
 * Instagram status handling, which keep their own provider semantics.
 */

export const WEBCHAT_ACK_STATUSES = ["delivered", "read"] as const;
export type WebchatAckStatus = (typeof WEBCHAT_ACK_STATUSES)[number];

/** Rank used for monotonic transitions. Mirrors the direct_messages status enum order. */
const STATUS_RANK_SQL = "'queued', 'sent', 'delivered', 'read'";

export const MAX_STATUS_UPDATES_PER_REQUEST = 100;

export interface StatusUpdateInput {
  messageId: string;
  status: WebchatAckStatus;
}

export interface StatusAckResult {
  /** Messages whose stored status actually advanced. */
  updated: string[];
  /** Messages that were valid and owned, but already at an equal/higher status. */
  unchanged: string[];
  /** Messages that do not belong to this session's conversation (or do not exist). */
  rejected: string[];
}

export function isWebchatAckStatus(value: unknown): value is WebchatAckStatus {
  return typeof value === "string" && (WEBCHAT_ACK_STATUSES as readonly string[]).includes(value);
}

function isUuidLike(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value);
}

/**
 * Parses and validates the raw ACK payload coming from the browser.
 * Throws an error with `statusCode` on malformed input.
 */
export function parseStatusUpdates(body: unknown): StatusUpdateInput[] {
  const updates = (body as { updates?: unknown })?.updates;
  if (!Array.isArray(updates)) {
    throw Object.assign(new Error("`updates` must be an array"), { statusCode: 400 });
  }
  if (updates.length === 0) {
    return [];
  }
  if (updates.length > MAX_STATUS_UPDATES_PER_REQUEST) {
    throw Object.assign(
      new Error(`At most ${MAX_STATUS_UPDATES_PER_REQUEST} status updates per request`),
      { statusCode: 400 },
    );
  }

  const parsed: StatusUpdateInput[] = [];
  const seen = new Set<string>();

  for (const raw of updates) {
    const messageId = (raw as { messageId?: unknown })?.messageId;
    const status = (raw as { status?: unknown })?.status;

    if (!isUuidLike(messageId)) {
      throw Object.assign(new Error("Each update requires a valid `messageId`"), { statusCode: 400 });
    }
    if (!isWebchatAckStatus(status)) {
      throw Object.assign(
        new Error("Each update requires `status` to be one of: delivered, read"),
        { statusCode: 400 },
      );
    }

    // Collapse duplicates inside a single request, keeping the highest status.
    const key = `${messageId}:${status}`;
    if (seen.has(key)) continue;
    seen.add(key);

    parsed.push({ messageId, status });
  }

  return parsed;
}

/**
 * Applies WebChat delivered/read ACKs for the authenticated session.
 *
 * Security invariants enforced in a single atomic statement per message:
 *  - the message belongs to the session's tenant
 *  - the message belongs to the session's conversation (never a client-supplied one)
 *  - the message belongs to the session's channel connection (widget isolation)
 *  - the message is `channel = 'webchat'`
 *  - the message is `direction = 'outgoing'` (visitors cannot ACK their own messages)
 *
 * Monotonicity is enforced by the same WHERE clause using FIELD(), so a late
 * `delivered` can never downgrade a message that is already `read`, even under
 * concurrent requests.
 */
export async function applyWebchatStatusAcks(
  session: WebchatSession,
  updates: StatusUpdateInput[],
): Promise<StatusAckResult> {
  const result: StatusAckResult = { updated: [], unchanged: [], rejected: [] };

  if (updates.length === 0 || !session.conversationId) {
    // Without a conversation there is nothing this session could legitimately ACK.
    result.rejected.push(...updates.map((u) => u.messageId));
    return result;
  }

  // Highest status wins when the same message is ACKed twice in one payload.
  const highestByMessage = new Map<string, WebchatAckStatus>();
  for (const update of updates) {
    const current = highestByMessage.get(update.messageId);
    if (current === "read") continue;
    highestByMessage.set(update.messageId, update.status);
  }

  for (const [messageId, status] of highestByMessage) {
    const timestampColumn = status === "delivered" ? "delivered_at" : "read_at";

    // A `read` ACK implies the browser received the message, so backfill
    // delivered_at when it is still empty. delivered_at stays <= read_at.
    const impliedDelivered =
      status === "read" ? ", delivered_at = COALESCE(delivered_at, NOW())" : "";

    const updateResult = (await db.query(
      `UPDATE direct_messages
       SET status = ?,
           ${timestampColumn} = COALESCE(${timestampColumn}, NOW())${impliedDelivered}
       WHERE id = ?
         AND tenant_id = ?
         AND conversation_id = ?
         AND channel_connection_id = ?
         AND channel = 'webchat'
         AND direction = 'outgoing'
         AND (
           status IS NULL
           OR FIELD(status, ${STATUS_RANK_SQL}) < FIELD(?, ${STATUS_RANK_SQL})
         )`,
      [
        status,
        messageId,
        session.tenantId,
        session.conversationId,
        session.channelConnectionId,
        status,
      ],
    )) as unknown as { affectedRows?: number };

    if ((updateResult?.affectedRows ?? 0) > 0) {
      result.updated.push(messageId);
      continue;
    }

    // No row changed: either the message is not ours, or it is already at an
    // equal/higher status. Distinguish the two so the widget can stop retrying.
    const owned = (await db.query(
      `SELECT id FROM direct_messages
       WHERE id = ?
         AND tenant_id = ?
         AND conversation_id = ?
         AND channel_connection_id = ?
         AND channel = 'webchat'
         AND direction = 'outgoing'
       LIMIT 1`,
      [messageId, session.tenantId, session.conversationId, session.channelConnectionId],
    )) as Array<{ id: string }>;

    if (owned.length > 0) {
      result.unchanged.push(messageId);
    } else {
      result.rejected.push(messageId);
    }
  }

  // Notify the CRM so the Inbox status indicator refreshes. Status events must
  // never create messages, trigger bots, or change unread counters.
  for (const messageId of result.updated) {
    const status = highestByMessage.get(messageId);
    try {
      await publishChatRealtimeEvent({
        type: "message.status",
        tenant_id: session.tenantId,
        contact_phone: `wc_${session.visitorId}`,
        message_id: messageId,
        provider_message_id: null,
        status: status ?? null,
      });
    } catch (error) {
      // Realtime delivery is best-effort; the DB is already the source of truth.
      console.warn("[WebChat Status] Failed to publish realtime status event", {
        tenantId: session.tenantId,
        messageId,
        status,
      });
    }
  }

  return result;
}
