"use server";

import { randomUUID } from "node:crypto";
import db from "./db";

export type WebhookEventInput = {
  userId?: string | null;
  source?: string;
  raw: unknown;
  processed?: boolean;
  eventType?: string;
  status?: string;
  errorMessage?: string | null;
};

export function buildWebhookEventInsert(
  available: ReadonlySet<string>,
  input: WebhookEventInput,
  id: string,
) {
  const payload = JSON.stringify(input.raw ?? {});
  const valuesByColumn: Record<string, unknown> = {
    id,
    user_id: input.userId ?? null,
    tenant_id: input.userId ?? null,
    source: input.source || "whatsapp",
    raw: payload,
    payload_json: payload,
    processed: input.processed ?? false,
    event_type: input.eventType || "generic",
    status: input.status || "pending",
    error_message: input.errorMessage ?? null,
  };
  const columns = Object.keys(valuesByColumn).filter((column) => available.has(column));

  if (!columns.includes("id") || (!columns.includes("raw") && !columns.includes("payload_json"))) {
    throw new Error("Schema de webhook_events incompatível: id/raw ausentes.");
  }

  return {
    sql: `INSERT INTO webhook_events (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    values: columns.map((column) => valuesByColumn[column]),
    columns,
  };
}

let webhookEventColumnsPromise: Promise<Set<string>> | null = null;

async function getWebhookEventColumns() {
  if (!webhookEventColumnsPromise) {
    webhookEventColumnsPromise = db
      .query<Array<{ Field: string }>>("SHOW COLUMNS FROM webhook_events")
      .then((columns) => new Set(columns.map((column) => column.Field)))
      .catch((error) => {
        webhookEventColumnsPromise = null;
        throw error;
      });
  }
  return webhookEventColumnsPromise;
}

/**
 * Persiste eventos tanto no schema atual quanto no legado da VPS.
 * O INSERT anterior enviava simultaneamente colunas novas e antigas; quando
 * uma delas não existia, o MySQL rejeitava a linha inteira e o painel ficava vazio.
 */
export async function insertWebhookEvent(input: WebhookEventInput) {
  const available = await getWebhookEventColumns();
  const id = randomUUID();
  const statement = buildWebhookEventInsert(available, input, id);
  await db.query(statement.sql, statement.values);

  return id;
}
