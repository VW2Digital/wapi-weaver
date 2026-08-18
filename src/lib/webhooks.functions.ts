"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import crypto from "crypto";

export async function ensureWebhookTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS incoming_webhooks (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        field_labels TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'listening',
        events_count INT NOT NULL DEFAULT 0,
        leads_count INT NOT NULL DEFAULT 0,
        last_event_at DATETIME NULL,
        last_contact_id VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Garante que last_contact_id existe mesmo em tabelas criadas antes da coluna ser adicionada
    await db.query(`
      ALTER TABLE incoming_webhooks
      ADD COLUMN IF NOT EXISTS last_contact_id VARCHAR(36) NULL
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS incoming_webhook_events (
        id VARCHAR(36) PRIMARY KEY,
        incoming_webhook_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NULL,
        raw_payload JSON NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        error_message TEXT NULL,
        mapped_standard_fields JSON NULL,
        mapped_custom_fields JSON NULL,
        unmapped_fields JSON NULL,
        headers JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        processing_duration_ms INT NULL,
        idempotency_key VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_webhook_id (incoming_webhook_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Garante que contact_id existe mesmo em tabelas criadas antes dessa coluna ser adicionada
    await db.query(`
      ALTER TABLE incoming_webhook_events
      ADD COLUMN IF NOT EXISTS contact_id VARCHAR(36) NULL
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS outgoing_webhooks (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        url TEXT NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        retry_count INT NOT NULL DEFAULT 3,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS outgoing_webhook_logs (
        id VARCHAR(36) PRIMARY KEY,
        outgoing_webhook_id VARCHAR(36) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSON NULL,
        response_status INT NULL,
        response_body TEXT NULL,
        error_message TEXT NULL,
        attempt_number INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.error("[Webhook Tables Setup Error]", e);
  }
}

const outgoingWebhookSchema = z.object({
  url: z.string().trim().url({ message: "URL inválida" }),
  event_type: z.enum([
    "LEAD_CREATED",
    "DEAL_STEP_CHANGED",
    "MESSAGE_RECEIVED",
    "AGENT_HANDOFF",
    "DEAL_WON",
    "DEAL_LOST",
  ]),
  retry_count: z.number().int().min(0).max(10).optional().default(3),
});

export const listIncomingWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureWebhookTables();
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = (await db.query(
      "SELECT * FROM incoming_webhooks WHERE tenant_id = ? ORDER BY created_at DESC",
      [effectiveUserId],
    )) as any[];

    if (!rows || rows.length === 0) return [];

    // Carrega os mapeamentos de campos para cada webhook
    const webhookIds = rows.map((r: any) => r.id);
    const placeholders = webhookIds.map(() => "?").join(", ");
    const mappings = (await db.query(
      `SELECT * FROM webhook_field_mappings WHERE webhook_id IN (${placeholders}) AND user_id = ? ORDER BY created_at ASC`,
      [...webhookIds, effectiveUserId],
    ).catch(() => [])) as any[];

    // Agrupa mapeamentos por webhook_id
    const mappingsByWebhook: Record<string, any[]> = {};
    for (const m of mappings) {
      if (!mappingsByWebhook[m.webhook_id]) mappingsByWebhook[m.webhook_id] = [];
      mappingsByWebhook[m.webhook_id].push(m);
    }

    return rows.map((r: any) => ({
      ...r,
      webhook_field_mappings: mappingsByWebhook[r.id] ?? [],
    }));
  });

export const createIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ name: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureWebhookTables();
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await db.query(
      "INSERT INTO incoming_webhooks (id, tenant_id, name, token, status, events_count, leads_count) VALUES (?, ?, ?, ?, 'listening', 0, 0)",
      [id, effectiveUserId, data.name, token],
    );
    return { id, token, name: data.name };
  });

export const updateIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "UPDATE incoming_webhooks SET name = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.id, effectiveUserId]
    );
    return { ok: true };
  });

export const duplicateIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const [wh] = (await db.query(
      "SELECT * FROM incoming_webhooks WHERE id = ? AND tenant_id = ?",
      [data.id, effectiveUserId]
    )) as any[];
    if (!wh) throw new Error("Webhook não encontrado.");

    const newId = crypto.randomUUID();
    const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const newName = `${wh.name} (Cópia)`;

    await db.query(
      "INSERT INTO incoming_webhooks (id, tenant_id, name, token, status, events_count, leads_count) VALUES (?, ?, ?, ?, ?, 0, 0)",
      [newId, effectiveUserId, newName, newToken, wh.status]
    );
    return { ok: true, id: newId };
  });

export const updateIncomingWebhookStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["listening", "paused"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "UPDATE incoming_webhooks SET status = ? WHERE id = ? AND tenant_id = ?",
      [data.status, data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const deleteIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "DELETE FROM incoming_webhooks WHERE id = ? AND tenant_id = ?",
      [data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const regenerateIncomingWebhookToken = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await db.query(
      "UPDATE incoming_webhooks SET token = ? WHERE id = ? AND tenant_id = ?",
      [token, data.id, effectiveUserId],
    );
    return { token };
  });

export const listOutgoingWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await ensureWebhookTables();
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = (await db.query(
      "SELECT * FROM outgoing_webhooks WHERE tenant_id = ? ORDER BY created_at DESC",
      [effectiveUserId],
    )) as any[];
    return rows ?? [];
  });

export const createOutgoingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => outgoingWebhookSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureWebhookTables();
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO outgoing_webhooks (id, tenant_id, url, event_type, retry_count, status) VALUES (?, ?, ?, ?, ?, 'active')",
      [id, effectiveUserId, data.url, data.event_type, data.retry_count],
    );
    return { id };
  });

export const updateOutgoingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid(), url: z.string().trim().url(), event_type: z.string(), retry_count: z.number().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "UPDATE outgoing_webhooks SET url = ?, event_type = ?, retry_count = ? WHERE id = ? AND tenant_id = ?",
      [data.url, data.event_type, data.retry_count || 3, data.id, effectiveUserId]
    );
    return { ok: true };
  });

export const duplicateOutgoingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const [wh] = (await db.query(
      "SELECT * FROM outgoing_webhooks WHERE id = ? AND tenant_id = ?",
      [data.id, effectiveUserId]
    )) as any[];
    if (!wh) throw new Error("Webhook de saída não encontrado.");

    const newId = crypto.randomUUID();
    await db.query(
      "INSERT INTO outgoing_webhooks (id, tenant_id, url, event_type, retry_count, status) VALUES (?, ?, ?, ?, ?, ?)",
      [newId, effectiveUserId, `${wh.url}?copy=1`, wh.event_type, wh.retry_count, wh.status]
    );
    return { ok: true, id: newId };
  });

export const updateOutgoingWebhookStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "paused"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "UPDATE outgoing_webhooks SET status = ? WHERE id = ? AND tenant_id = ?",
      [data.status, data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const deleteOutgoingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "DELETE FROM outgoing_webhooks WHERE id = ? AND tenant_id = ?",
      [data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const listOutgoingWebhookLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) => z.object({ webhook_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = (await db.query(
      `SELECT l.* FROM outgoing_webhook_logs l
       JOIN outgoing_webhooks w ON w.id = l.outgoing_webhook_id
       WHERE w.id = ? AND w.tenant_id = ?
       ORDER BY l.created_at DESC LIMIT 50`,
      [data.webhook_id, effectiveUserId],
    )) as any[];
    return rows ?? [];
  });

export const updateIncomingWebhookFieldLabels = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), labels: z.record(z.string(), z.string()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      "UPDATE incoming_webhooks SET field_labels = ? WHERE id = ? AND tenant_id = ?",
      [JSON.stringify(data.labels), data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const listIncomingWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) => z.object({ webhook_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const [webhook] = (await db.query(
      "SELECT id FROM incoming_webhooks WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.webhook_id, effectiveUserId],
    )) as any[];

    if (!webhook) throw new Error("Webhook não encontrado");

    const events = (await db.query(
      `SELECT id, COALESCE(raw_payload, '') as raw_payload_str, status, error_message, created_at
       FROM incoming_webhook_events
       WHERE incoming_webhook_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [data.webhook_id],
    )) as any[];

    const fieldKeysSet = new Set<string>();
    const parsedEvents = (events || []).map((e: any) => {
      let payload: Record<string, unknown> = {};
      try {
        const raw = typeof e.raw_payload_str === "string" ? JSON.parse(e.raw_payload_str) : (e.raw_payload_str ?? {});
        if (Array.isArray(raw) && raw.length > 0) {
          const first = raw[0];
          payload = (first?.body ?? first ?? {}) as Record<string, unknown>;
        } else if (typeof raw === "object") {
          payload = raw as Record<string, unknown>;
        }
      } catch {}

      Object.keys(payload).forEach((k) => {
        if (k !== "headers" && k !== "executionMode" && k !== "webhookUrl" && k !== "query" && k !== "params") {
          fieldKeysSet.add(k);
        }
      });

      return {
        id: e.id,
        status: e.status,
        error_message: e.error_message,
        created_at: String(e.created_at),
        payload: payload as Record<string, string | number | boolean | null>,
        fields: Object.keys(payload).filter((k) => payload[k] != null && k !== "headers" && k !== "executionMode" && k !== "webhookUrl"),
      };
    });

    return {
      events: parsedEvents,
      discovered_fields: Array.from(fieldKeysSet),
    };
  });

export const listWebhookLeads = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({
      webhook_id: z.string().uuid(),
      page: z.number().int().min(1).optional().default(1),
      limit: z.number().int().min(1).max(100).optional().default(50),
      status: z.enum(["all", "success", "error"]).optional().default("all"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const [webhook] = (await db.query(
      "SELECT id, name, leads_count, events_count FROM incoming_webhooks WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.webhook_id, effectiveUserId],
    )) as any[];
    if (!webhook) throw new Error("Webhook não encontrado");

    const offset = ((data.page || 1) - 1) * (data.limit || 50);
    const statusFilter = data.status === "all" ? "" : " AND e.status = ?";
    const statusArgs = data.status === "all" ? [] : [data.status];

    const events = (await db.query(
      `SELECT
         e.id,
         e.status,
         e.error_message,
         e.raw_payload,
         e.mapped_standard_fields,
         e.mapped_custom_fields,
         e.unmapped_fields,
         e.ip_address,
         e.user_agent,
         e.processing_duration_ms,
         e.created_at,
         c.id AS contact_id,
         c.name AS contact_name,
         c.phone_e164 AS contact_phone,
         c.email AS contact_email
       FROM incoming_webhook_events e
       LEFT JOIN contacts c ON c.id = e.contact_id AND c.user_id = ?
       WHERE e.incoming_webhook_id = ?${statusFilter}
       ORDER BY e.created_at DESC
       LIMIT ? OFFSET ?`,
      [effectiveUserId, data.webhook_id, ...statusArgs, data.limit || 50, offset],
    ).catch(async () => {
      // Fallback sem JOIN caso haja incompatibilidade de schema (contact_id ainda não existe)
      return db.query(
        `SELECT e.id, e.status, e.error_message, e.raw_payload, e.mapped_standard_fields,
                e.mapped_custom_fields, e.unmapped_fields, e.ip_address, e.user_agent,
                e.processing_duration_ms, e.created_at
         FROM incoming_webhook_events e
         WHERE e.incoming_webhook_id = ?${statusFilter}
         ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
        [data.webhook_id, ...statusArgs, data.limit || 50, offset],
      );
    })) as any[];

    const [[{ total }]] = (await db.query(
      `SELECT COUNT(*) as total FROM incoming_webhook_events WHERE incoming_webhook_id = ?${statusFilter}`,
      [data.webhook_id, ...statusArgs],
    ).catch(() => [[{ total: 0 }]])) as any[][];

    const parsed = (events || []).map((e: any) => {
      let payload: Record<string, any> = {};
      let mappedStd: Record<string, any> = {};
      let mappedCustom: Record<string, any> = {};
      let unmapped: Record<string, any> = {};

      try { payload = typeof e.raw_payload === "string" ? JSON.parse(e.raw_payload) : (e.raw_payload ?? {}); } catch {}
      try { mappedStd = typeof e.mapped_standard_fields === "string" ? JSON.parse(e.mapped_standard_fields) : (e.mapped_standard_fields ?? {}); } catch {}
      try { mappedCustom = typeof e.mapped_custom_fields === "string" ? JSON.parse(e.mapped_custom_fields) : (e.mapped_custom_fields ?? {}); } catch {}
      try { unmapped = typeof e.unmapped_fields === "string" ? JSON.parse(e.unmapped_fields) : (e.unmapped_fields ?? {}); } catch {}

      // Extrai nome/telefone/email do payload para exibição
      const displayName = mappedStd?.name ?? payload?.nome ?? payload?.name ?? payload?.full_name ?? "—";
      const displayPhone = mappedStd?.phone ?? payload?.telefone ?? payload?.phone ?? payload?.whatsapp ?? "—";
      const displayEmail = mappedStd?.email ?? payload?.email ?? "—";

      return {
        id: e.id,
        status: e.status ?? "success",
        error_message: e.error_message ?? null,
        ip_address: e.ip_address ?? null,
        user_agent: e.user_agent ?? null,
        processing_ms: e.processing_duration_ms ?? null,
        created_at: e.created_at,
        contact_id: e.contact_id ?? null,
        contact_name: e.contact_name ?? null,
        contact_phone: e.contact_phone ?? null,
        contact_email: e.contact_email ?? null,
        display_name: displayName,
        display_phone: displayPhone,
        display_email: displayEmail,
        payload,
        mapped_standard: mappedStd,
        mapped_custom: mappedCustom,
        unmapped,
      };
    });

    return {
      webhook,
      events: parsed,
      total: Number(total ?? 0),
      page: data.page || 1,
      limit: data.limit || 50,
    };
  });
