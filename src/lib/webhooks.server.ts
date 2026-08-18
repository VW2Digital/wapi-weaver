import db from "./db";
import crypto from "crypto";

export interface IncomingWebhookRow {
  id: string;
  tenant_id: string;
  name: string;
  token: string;
  field_labels: string | null;
  status: "listening" | "paused";
  events_count: number;
  leads_count: number;
  last_event_at: string | null;
}

export function resolveDotPath(obj: Record<string, any>, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return (acc as Record<string, any>)[key];
    return undefined;
  }, obj);
}

export function applyTransform(value: unknown, transform: string): unknown {
  switch (transform) {
    case "normalize_phone": {
      if (!value || typeof value !== "string") return value;
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) return digits;
      return value;
    }
    case "lowercase": return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase": return typeof value === "string" ? value.toUpperCase() : value;
    case "trim": return typeof value === "string" ? value.trim() : value;
    case "parse_number": {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case "parse_date": {
      if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d.toISOString();
      }
      return value;
    }
    case "parse_boolean": {
      if (typeof value === "string") {
        if (["true", "1", "yes", "sim"].includes(value.toLowerCase())) return true;
        if (["false", "0", "no", "nao", "não"].includes(value.toLowerCase())) return false;
      }
      return value;
    }
    default: return value;
  }
}

export async function findIncomingWebhookByToken(token: string): Promise<IncomingWebhookRow | null> {
  const rows = (await db.query(
    "SELECT * FROM incoming_webhooks WHERE token = ? LIMIT 1",
    [token],
  )) as IncomingWebhookRow[];
  return rows?.[0] ?? null;
}

export async function logIncomingWebhookEvent(
  webhookId: string,
  rawPayload: unknown,
  status: "success" | "error",
  errorMessage?: string,
  extra?: {
    contactId?: string;
    mappedStandardFields?: Record<string, unknown>;
    mappedCustomFields?: Record<string, unknown>;
    unmappedFields?: string[];
    headers?: Record<string, string>;
    ipAddress?: string;
    userAgent?: string;
    processingDurationMs?: number;
    idempotencyKey?: string;
  },
) {
  const insertWithContactId = async () => db.query(
    `INSERT INTO incoming_webhook_events
     (incoming_webhook_id, contact_id, raw_payload, status, error_message, mapped_standard_fields, mapped_custom_fields, unmapped_fields, headers, ip_address, user_agent, processing_duration_ms, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      webhookId,
      extra?.contactId ?? null,
      JSON.stringify(rawPayload),
      status,
      errorMessage ?? null,
      extra?.mappedStandardFields ? JSON.stringify(extra.mappedStandardFields) : null,
      extra?.mappedCustomFields ? JSON.stringify(extra.mappedCustomFields) : null,
      extra?.unmappedFields ? JSON.stringify(extra.unmappedFields) : null,
      extra?.headers ? JSON.stringify(extra.headers) : null,
      extra?.ipAddress ?? null,
      extra?.userAgent ?? null,
      extra?.processingDurationMs ?? null,
      extra?.idempotencyKey ?? null,
    ],
  );

  const insertWithoutContactId = async () => db.query(
    `INSERT INTO incoming_webhook_events
     (incoming_webhook_id, raw_payload, status, error_message, mapped_standard_fields, mapped_custom_fields, unmapped_fields, headers, ip_address, user_agent, processing_duration_ms, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      webhookId,
      JSON.stringify(rawPayload),
      status,
      errorMessage ?? null,
      extra?.mappedStandardFields ? JSON.stringify(extra.mappedStandardFields) : null,
      extra?.mappedCustomFields ? JSON.stringify(extra.mappedCustomFields) : null,
      extra?.unmappedFields ? JSON.stringify(extra.unmappedFields) : null,
      extra?.headers ? JSON.stringify(extra.headers) : null,
      extra?.ipAddress ?? null,
      extra?.userAgent ?? null,
      extra?.processingDurationMs ?? null,
      extra?.idempotencyKey ?? null,
    ],
  );

  try {
    await insertWithContactId();
  } catch {
    // Fallback para bancos que ainda não têm a coluna contact_id
    await insertWithoutContactId();
  }
}

export async function incrementIncomingWebhookStats(
  webhookId: string,
  createdLead: boolean,
  contactId?: string,
) {
  const leadInc = createdLead ? ", leads_count = leads_count + 1" : "";
  const contactInc = contactId ? ", last_contact_id = ?" : "";
  const params: any[] = [];
  if (contactId) params.push(contactId);
  params.push(webhookId);
  await db.query(
    `UPDATE incoming_webhooks SET events_count = events_count + 1${leadInc}${contactInc}, last_event_at = NOW() WHERE id = ?`,
    params,
  );
}

export async function upsertContactFromWebhook(
  tenantId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    notes?: string;
    status?: string;
    external_id?: string;
    responsible_user_id?: string | null;
    custom_fields?: Record<string, unknown>;
  },
  webhook?: { id: string; name: string },
): Promise<{ id: string; created: boolean }> {
  const { normalizeToE164 } = await import("@/lib/phone");

  let phone: string | null = null;
  if (payload.phone) phone = normalizeToE164(payload.phone);
  if (!phone && payload.external_id && !payload.email) {
    throw new Error("É necessário fornecer telefone, email ou external_id para criar um contato");
  }

  return await db.transaction(async (conn) => {
    let contactId: string = "";
    let created = false;

    // Dedup: external_id > phone > email
    if (payload.external_id) {
      const [existing] = (await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND external_id = ? LIMIT 1",
        [tenantId, payload.external_id],
      )) as any;
      if (existing?.length > 0) {
        contactId = existing[0].id;
        const updates: string[] = [];
        const params: any[] = [];
        if (payload.name !== undefined) { updates.push("name = ?"); params.push(payload.name); }
        if (payload.email !== undefined) { updates.push("email = ?"); params.push(payload.email); }
        if (phone) { updates.push("phone_e164 = ?"); params.push(phone); }
        if (payload.company !== undefined) { updates.push("company = ?"); params.push(payload.company); }
        if (payload.position !== undefined) { updates.push("position = ?"); params.push(payload.position); }
        if (payload.notes !== undefined) { updates.push("notes = ?"); params.push(payload.notes); }
        if (payload.status !== undefined) { updates.push("status = ?"); params.push(payload.status); }
        if (payload.responsible_user_id !== undefined) { updates.push("responsible_user_id = ?"); params.push(payload.responsible_user_id); }
        updates.push("last_interaction_at = NOW()");
        params.push(contactId);
        await conn.execute(
          `UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
      }
    }

    if (!contactId && phone) {
      const [existing] = (await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1",
        [tenantId, phone],
      )) as any;
      if (existing?.length > 0) {
        contactId = existing[0].id;
        const updates: string[] = [];
        const params: any[] = [];
        if (payload.name !== undefined) { updates.push("name = ?"); params.push(payload.name); }
        if (payload.email !== undefined) { updates.push("email = ?"); params.push(payload.email); }
        if (payload.external_id !== undefined) { updates.push("external_id = ?"); params.push(payload.external_id); }
        if (payload.company !== undefined) { updates.push("company = ?"); params.push(payload.company); }
        if (payload.position !== undefined) { updates.push("position = ?"); params.push(payload.position); }
        if (payload.notes !== undefined) { updates.push("notes = ?"); params.push(payload.notes); }
        if (payload.status !== undefined) { updates.push("status = ?"); params.push(payload.status); }
        if (payload.responsible_user_id !== undefined) { updates.push("responsible_user_id = ?"); params.push(payload.responsible_user_id); }
        updates.push("last_interaction_at = NOW()");
        params.push(contactId);
        await conn.execute(
          `UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
      }
    }

    if (!contactId && payload.email) {
      const [existing] = (await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND email = ? LIMIT 1",
        [tenantId, payload.email],
      )) as any;
      if (existing?.length > 0) {
        contactId = existing[0].id;
        const updates: string[] = [];
        const params: any[] = [];
        if (payload.name !== undefined) { updates.push("name = ?"); params.push(payload.name); }
        if (phone) { updates.push("phone_e164 = ?"); params.push(phone); }
        if (payload.external_id !== undefined) { updates.push("external_id = ?"); params.push(payload.external_id); }
        if (payload.company !== undefined) { updates.push("company = ?"); params.push(payload.company); }
        if (payload.position !== undefined) { updates.push("position = ?"); params.push(payload.position); }
        if (payload.notes !== undefined) { updates.push("notes = ?"); params.push(payload.notes); }
        if (payload.status !== undefined) { updates.push("status = ?"); params.push(payload.status); }
        if (payload.responsible_user_id !== undefined) { updates.push("responsible_user_id = ?"); params.push(payload.responsible_user_id); }
        updates.push("last_interaction_at = NOW()");
        params.push(contactId);
        await conn.execute(
          `UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
      }
    }

    if (!contactId) {
      created = true;
      contactId = crypto.randomUUID();
      const hasStatus = payload.status !== undefined && payload.status !== null && payload.status !== "";
      await conn.execute(
        `INSERT INTO contacts
         (id, user_id, tenant_id, phone_e164, name, email, company, position, notes${hasStatus ? ", status" : ""}, external_id, responsible_user_id, source, source_type, source_name, source_id, last_interaction_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${hasStatus ? ", ?" : ""}, ?, ?, 'webhook', 'incoming_webhook', ?, ?, NOW())`,
        [
          contactId,
          tenantId,
          tenantId,
          phone,
          payload.name ?? null,
          payload.email ?? null,
          payload.company ?? null,
          payload.position ?? null,
          payload.notes ?? null,
          ...(hasStatus ? [payload.status as string] : []),
          payload.external_id ?? null,
          payload.responsible_user_id ?? null,
          webhook?.name ?? null,
          webhook?.id ?? null,
        ],
      );
    }

    if (payload.custom_fields && Object.keys(payload.custom_fields).length > 0) {
      const [customFieldRows] = (await conn.execute(
        "SELECT custom_fields FROM contacts WHERE id = ? AND tenant_id = ? LIMIT 1",
        [contactId, tenantId],
      )) as [Array<{ custom_fields?: string | Record<string, unknown> | null }>, unknown];
      const storedValue = customFieldRows?.[0]?.custom_fields;
      let storedCustomFields: Record<string, unknown> = {};
      if (typeof storedValue === "string") {
        try {
          const parsed = JSON.parse(storedValue);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            storedCustomFields = parsed as Record<string, unknown>;
          }
        } catch {}
      } else if (storedValue && typeof storedValue === "object") {
        storedCustomFields = storedValue;
      }

      await conn.execute(
        "UPDATE contacts SET custom_fields = ? WHERE id = ? AND tenant_id = ?",
        [JSON.stringify({ ...storedCustomFields, ...payload.custom_fields }), contactId, tenantId],
      );
    }

    // Log activity
    try {
      await conn.execute(
        `INSERT INTO contact_activities (contact_id, user_id, type, title, description, source_type, source_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contactId,
          tenantId,
          created ? "created" : "updated",
          created
            ? `Contato criado via Webhook${webhook ? `: ${webhook.name}` : ""}`
            : `Contato atualizado via Webhook${webhook ? `: ${webhook.name}` : ""}`,
          created ? null : `Dados recebidos: name=${payload.name ?? "(não enviado)"}, email=${payload.email ?? "(não enviado)"}`,
          "incoming_webhook",
          webhook?.id ?? null,
          JSON.stringify(payload),
        ],
      );
    } catch {
      // Non-critical
    }

    return { id: contactId, created };
  });
}

export type WebhookEventType =
  | "LEAD_CREATED"
  | "LEAD_UPDATED"
  | "DEAL_CREATED"
  | "DEAL_STEP_CHANGED"
  | "DEAL_WON"
  | "DEAL_LOST";

export interface WebhookEventPayload {
  event_type: WebhookEventType;
  tenant_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverWebhook(
  webhookId: string,
  eventType: string,
  payload: WebhookEventPayload,
  maxRetries: number,
): Promise<void> {
  const [webhook] = (await db.query(
    "SELECT url FROM outgoing_webhooks WHERE id = ?",
    [webhookId],
  )) as Array<{ url: string }>;

  if (!webhook) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();

      await db.query(
        `INSERT INTO outgoing_webhook_logs
         (outgoing_webhook_id, event_type, payload_sent, response_status, response_body, attempt_number, success)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          webhookId,
          eventType,
          JSON.stringify(payload),
          response.status,
          responseBody.slice(0, 5000),
          attempt,
          response.ok,
        ],
      );

      if (response.ok) return;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      await db.query(
        `INSERT INTO outgoing_webhook_logs
         (outgoing_webhook_id, event_type, payload_sent, response_status, response_body, attempt_number, success)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [webhookId, eventType, JSON.stringify(payload), null, errMsg, attempt, false],
      );

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
}

export async function emitEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const payload: WebhookEventPayload = {
    event_type: eventType,
    tenant_id: tenantId,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const webhooks = (await db.query(
      "SELECT id, retry_count FROM outgoing_webhooks WHERE tenant_id = ? AND event_type = ? AND status = 'active'",
      [tenantId, eventType],
    )) as Array<{ id: string; retry_count: number }>;

    if (!webhooks || webhooks.length === 0) return;

    for (const wh of webhooks) {
      deliverWebhook(wh.id, eventType, payload, wh.retry_count).catch((err) => {
        console.error(`[Webhook] Failed to deliver ${wh.id}:`, err);
      });
    }
  } catch (err) {
    console.error("[Webhook] Error emitting event:", err);
  }
}

export function matchWebhookPayload(payload: Record<string, any>, conditions: any[]): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;

  for (const cond of conditions) {
    const { field, operator, value } = cond;
    if (!field) return false;

    const rawVal = resolveDotPath(payload, field);

    switch (operator) {
      case "equals": {
        if (rawVal === undefined || rawVal === null) return false;
        if (String(rawVal).toLowerCase() !== String(value).toLowerCase()) return false;
        break;
      }
      case "contains": {
        if (rawVal === undefined || rawVal === null) return false;
        if (!String(rawVal).toLowerCase().includes(String(value).toLowerCase())) return false;
        break;
      }
      case "exists": {
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "") return false;
        break;
      }
      default:
        return false;
    }
  }

  return true;
}
