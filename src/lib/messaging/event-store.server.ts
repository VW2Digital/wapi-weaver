"use server";

import { randomUUID } from "crypto";
import db from "@/lib/db";
import type { CanonicalEvent } from "./types";

function toMySQLDateTime(value: string | number | Date | undefined): string {
  const d = typeof value === "string" ? new Date(value) : value instanceof Date ? value : new Date(value ?? Date.now());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export interface PersistResult {
  eventId: string;
  inserted: boolean;
  skipped: boolean;
}

export interface MessagingEventRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  provider: string;
  channel_resource_id: string;
  channel_connection_id: string | null;
  meta_app_connection_id: string | null;
  external_event_id: string;
  event_type: string;
  payload_json: string;
  raw_payload_json: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempt_count: number;
  last_error: string | null;
  received_at: Date;
  processed_at: Date | null;
  created_at: Date;
}

/**
 * Persiste um evento canônico na store idempotente.
 *
 * A idempotência é garantida por
 *   UNIQUE KEY (tenant_id, provider, external_event_id).
 *
 * Se o evento já existe, o registro original é preservado e retorna
 * `inserted: false, skipped: true`. Isso evita duplicidade mesmo quando
 * a Meta reenvia o mesmo webhook.
 */
export async function persistCanonicalEvent(event: CanonicalEvent): Promise<PersistResult> {
  const eventId = event.id ?? randomUUID();
  const receivedAt = toMySQLDateTime(event.receivedAt);

  const result = await db.query<{ affectedRows: number; insertId: number }>(
    `INSERT INTO messaging_events (
       id, tenant_id, user_id, provider, channel_resource_id,
       channel_connection_id, meta_app_connection_id,
       external_event_id, event_type, payload_json, raw_payload_json,
       status, attempt_count, received_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       id = id`, // no-op para manter o registro original
    [
      eventId,
      event.tenantId,
      event.userId ?? null,
      event.provider,
      event.channelResourceId,
      event.channelConnectionId ?? null,
      event.metaAppConnectionId ?? null,
      event.externalEventId,
      event.eventType,
      JSON.stringify(event.payload),
      JSON.stringify(event.rawPayload),
      event.status,
      event.attemptCount,
      receivedAt,
    ],
  );

  const inserted = (result?.affectedRows ?? 0) === 1;

  if (!inserted) {
    const [existing] = await db.query<Array<{ id: string }>>(
      `SELECT id FROM messaging_events
       WHERE tenant_id = ? AND provider = ? AND external_event_id = ?
       LIMIT 1`,
      [event.tenantId, event.provider, event.externalEventId],
    );
    return { eventId: existing?.id ?? eventId, inserted: false, skipped: true };
  }

  return { eventId, inserted: true, skipped: false };
}

/**
 * Persiste uma lista de eventos canônicos em uma única transação.
 */
export async function persistCanonicalEvents(events: CanonicalEvent[]): Promise<PersistResult[]> {
  return db.transaction(async (conn) => {
    const results: PersistResult[] = [];
    for (const event of events) {
      const eventId = event.id ?? randomUUID();
      const receivedAt = toMySQLDateTime(event.receivedAt);

      const [insertResult] = await conn.execute(
        `INSERT INTO messaging_events (
           id, tenant_id, user_id, provider, channel_resource_id,
           channel_connection_id, meta_app_connection_id,
           external_event_id, event_type, payload_json, raw_payload_json,
           status, attempt_count, received_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [
          eventId,
          event.tenantId,
          event.userId ?? null,
          event.provider,
          event.channelResourceId,
          event.channelConnectionId ?? null,
          event.metaAppConnectionId ?? null,
          event.externalEventId,
          event.eventType,
          JSON.stringify(event.payload),
          JSON.stringify(event.rawPayload),
          event.status,
          event.attemptCount,
          receivedAt,
        ],
      );

      const result = insertResult as { affectedRows: number };
      if (result.affectedRows === 1) {
        results.push({ eventId, inserted: true, skipped: false });
      } else {
        const [rows] = await conn.execute(
          `SELECT id FROM messaging_events
           WHERE tenant_id = ? AND provider = ? AND external_event_id = ?
           LIMIT 1`,
          [event.tenantId, event.provider, event.externalEventId],
        );
        const existing = (rows as Array<{ id: string }>)?.[0];
        results.push({ eventId: existing?.id ?? eventId, inserted: false, skipped: true });
      }
    }
    return results;
  });
}

/**
 * Retorna eventos pendentes para processamento, ordenados por recebimento.
 */
export async function getPendingEvents(
  limit: number = 100,
): Promise<MessagingEventRow[]> {
  return db.query<MessagingEventRow[]>(
    `SELECT * FROM messaging_events
     WHERE status = 'pending'
     ORDER BY received_at ASC, created_at ASC
     LIMIT ?`,
    [limit],
  );
}

/**
 * Retorna um evento canônico pelo id.
 */
export async function getMessagingEventById(
  eventId: string,
): Promise<MessagingEventRow | null> {
  const rows = await db.query<MessagingEventRow[]>(
    `SELECT * FROM messaging_events
     WHERE id = ?
     LIMIT 1`,
    [eventId],
  );
  return rows?.[0] ?? null;
}

/**
 * Marca um evento como em processamento.
 */
export async function markEventProcessing(eventId: string): Promise<void> {
  await db.query(
    `UPDATE messaging_events
     SET status = 'processing', attempt_count = attempt_count + 1
     WHERE id = ?`,
    [eventId],
  );
}

/**
 * Marca um evento como processado com sucesso.
 */
export async function markEventCompleted(eventId: string): Promise<void> {
  await db.query(
    `UPDATE messaging_events
     SET status = 'completed', processed_at = NOW()
     WHERE id = ?`,
    [eventId],
  );
}

/**
 * Marca um evento como falho, preservando a mensagem de erro.
 */
export async function markEventFailed(eventId: string, errorMessage: string): Promise<void> {
  await db.query(
    `UPDATE messaging_events
     SET status = 'failed', last_error = ?, processed_at = NOW()
     WHERE id = ?`,
    [errorMessage.slice(0, 2000), eventId],
  );
}

/**
 * Reidrata um evento canônico a partir de uma linha do banco.
 */
function safeParseJson<T = unknown>(value: string | T): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

export function hydrateCanonicalEvent(row: MessagingEventRow): CanonicalEvent {
  return {
    id: row.id,
    provider: row.provider as CanonicalEvent["provider"],
    tenantId: row.tenant_id,
    userId: row.user_id,
    eventType: row.event_type as CanonicalEvent["eventType"],
    externalEventId: row.external_event_id,
    channelResourceId: row.channel_resource_id,
    channelConnectionId: row.channel_connection_id,
    metaAppConnectionId: row.meta_app_connection_id,
    receivedAt: new Date(row.received_at).toISOString(),
    payload: safeParseJson(row.payload_json),
    rawPayload: safeParseJson(row.raw_payload_json),
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  };
}
