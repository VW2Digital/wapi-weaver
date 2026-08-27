"use server";

import { randomUUID } from "crypto";
import db from "@/lib/db";

export type WebhookDeliveryOutcome =
  | "received"
  | "rejected_signature"
  | "rejected_unconfigured"
  | "rejected_parse"
  | "rejected_no_events"
  | "persistence_failed"
  | "persisted"
  | "queued";

export interface WebhookDeliveryLogInput {
  provider: string;
  tenantId?: string | null;
  channelResourceId?: string | null;
  httpStatus: number;
  outcome: WebhookDeliveryOutcome;
  rawBody: unknown;
  errorMessage?: string | null;
  ipAddress?: string | null;
}

function toMySQLDateTime(value: string | number | Date | undefined): string {
  const d =
    typeof value === "string"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(value ?? Date.now());
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function logWebhookDelivery(input: WebhookDeliveryLogInput): Promise<void> {
  const receivedAt = toMySQLDateTime(Date.now());
  await db.query(
    `INSERT INTO webhook_delivery_logs (
      id, provider, tenant_id, channel_resource_id, http_status,
      outcome, raw_body, error_message, ip_address, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.provider,
      input.tenantId ?? null,
      input.channelResourceId ?? null,
      input.httpStatus,
      input.outcome,
      JSON.stringify(input.rawBody ?? null),
      input.errorMessage ?? null,
      input.ipAddress ?? null,
      receivedAt,
    ],
  );
}
