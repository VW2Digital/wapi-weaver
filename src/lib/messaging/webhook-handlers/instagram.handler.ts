"use server";

import { createHmac, timingSafeEqual } from "crypto";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import { resolveInstagramTenant } from "@/lib/messaging/services/tenant-resolution.service";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";
import { logWebhookDelivery } from "@/lib/messaging/webhook-delivery-log.server";

function logInfo(message: string, data?: unknown) {
  console.log(`[instagram-handler] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: unknown) {
  console.error(`[instagram-handler] ${message}`, data ? JSON.stringify(data) : "");
}

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export async function processInstagramWebhook(rawBody: string, signature: string | null): Promise<Response> {
  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (e: any) {
    logError("JSON parsing failed", e.message);
    await logWebhookDelivery({
      provider: "instagram",
      httpStatus: 400,
      outcome: "rejected_parse",
      rawBody: rawBody,
      errorMessage: e.message,
    }).catch(() => {});
    return new Response("Bad Request", { status: 400 });
  }

  const pageId = (payload as any)?.entry?.[0]?.id;
  if (!pageId) {
    logError("Meta page ID not found in payload");
    await logWebhookDelivery({
      provider: "instagram",
      httpStatus: 400,
      outcome: "rejected_unconfigured",
      rawBody: payload,
      errorMessage: "Meta page ID not found in payload",
    }).catch(() => {});
    return new Response("Page ID missing", { status: 400 });
  }

  const resolution = await resolveInstagramTenant(pageId);
  if (!resolution.resolved) {
    logError("Tenant not found for Instagram page", { pageId, reason: resolution.reason });
    await logWebhookDelivery({
      provider: "instagram",
      channelResourceId: pageId,
      httpStatus: 404,
      outcome: "rejected_unconfigured",
      rawBody: payload,
      errorMessage: `Tenant not found for Instagram page: ${resolution.reason}`,
    }).catch(() => {});
    return new Response("Account not integrated", { status: 404 });
  }

  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const verified = await verifySignature(rawBody, signature, appSecret);
    if (!verified) {
      logError("Signature validation failed");
      await logWebhookDelivery({
        provider: "instagram",
        channelResourceId: pageId,
        httpStatus: 403,
        outcome: "rejected_signature",
        rawBody: payload,
        errorMessage: "Signature validation failed",
      }).catch(() => {});
      return new Response("Forbidden (Invalid Signature)", { status: 403 });
    }
  }

  const { events, diagnostics } = instagramAdapter.normalize(payload);
  logInfo("Adapter normalized events", { count: events.length, diagnostics });

  if (events.length === 0) {
    await logWebhookDelivery({
      provider: "instagram",
      tenantId: resolution.resolved!.tenantId,
      channelResourceId: pageId,
      httpStatus: 200,
      outcome: "rejected_no_events",
      rawBody: payload,
    }).catch(() => {});
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  for (const event of events) {
    event.tenantId = resolution.resolved!.tenantId;
    event.userId = resolution.resolved!.userId;
  }

  let persisted: Array<{ eventId: string; skipped: boolean }> = [];
  try {
    persisted = await persistCanonicalEvents(events);
    logInfo("Events persisted", { count: persisted.length });
  } catch (persistError: any) {
    logError("Falha ao persistir eventos canônicos", persistError);
    await logWebhookDelivery({
      provider: "instagram",
      tenantId: resolution.resolved!.tenantId,
      channelResourceId: pageId,
      httpStatus: 500,
      outcome: "persistence_failed",
      rawBody: payload,
      errorMessage: persistError?.message ?? String(persistError),
    }).catch(() => {});
    return new Response("Webhook event persistence failed", { status: 500 });
  }

  for (const result of persisted) {
    if (!result.skipped) {
      await enqueueMessagingEvent(result.eventId);
    }
  }

  await logWebhookDelivery({
    provider: "instagram",
    tenantId: resolution.resolved!.tenantId,
    channelResourceId: pageId,
    httpStatus: 200,
    outcome: "queued",
    rawBody: payload,
  }).catch(() => {});
  return new Response("EVENT_RECEIVED", { status: 200 });
}
