import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import crypto from "crypto";

const incomingWebhookSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

const outgoingWebhookSchema = z.object({
  url: z.string().trim().url().max(500),
  event_type: z.enum([
    "LEAD_CREATED",
    "LEAD_UPDATED",
    "DEAL_CREATED",
    "DEAL_STEP_CHANGED",
    "DEAL_WON",
    "DEAL_LOST",
  ]),
  retry_count: z.number().int().min(0).max(10).default(3),
});

export const listIncomingWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    return db.query(
      "SELECT * FROM incoming_webhooks WHERE tenant_id = ? ORDER BY created_at DESC",
      [effectiveUserId],
    );
  });

export const createIncomingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => incomingWebhookSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await db.query(
      "INSERT INTO incoming_webhooks (id, tenant_id, name, token) VALUES (?, ?, ?, ?)",
      [id, effectiveUserId, data.name, token],
    );
    return { id, token, name: data.name };
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
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    return db.query(
      "SELECT * FROM outgoing_webhooks WHERE tenant_id = ? ORDER BY created_at DESC",
      [effectiveUserId],
    );
  });

export const createOutgoingWebhook = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => outgoingWebhookSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO outgoing_webhooks (id, tenant_id, url, event_type, retry_count) VALUES (?, ?, ?, ?, ?)",
      [id, effectiveUserId, data.url, data.event_type, data.retry_count],
    );
    return { id };
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
      `SELECT id, payload, status, error_message, created_at
       FROM incoming_webhook_events
       WHERE incoming_webhook_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [data.webhook_id],
    )) as any[];

    const fieldKeysSet = new Set<string>();
    const parsed = events.map((e: any) => {
      let payload: Record<string, unknown> = {};
      try {
        payload =
          typeof e.payload === "string"
            ? JSON.parse(e.payload)
            : (e.payload ?? {});
      } catch {}

      if (payload.custom_fields && typeof payload.custom_fields === "object") {
        Object.keys(payload.custom_fields as Record<string, unknown>).forEach(
          (k) => fieldKeysSet.add(k),
        );
      }

      return {
        id: e.id,
        status: e.status,
        error_message: e.error_message,
        created_at: e.created_at,
        fields: Object.keys(payload).filter((k) => payload[k] != null),
      };
    });

    return {
      events: parsed,
      discovered_fields: Array.from(fieldKeysSet).sort(),
    };
  });

export const listOutgoingWebhookLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) => z.object({ webhook_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    return db.query(
      `SELECT l.* FROM outgoing_webhook_logs l
       JOIN outgoing_webhooks w ON l.outgoing_webhook_id = w.id
       WHERE l.outgoing_webhook_id = ? AND w.tenant_id = ?
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [data.webhook_id, effectiveUserId],
    );
  });
