import { createFileRoute } from "@tanstack/react-router";
import { messengerAdapter } from "@/lib/messaging/adapters/messenger.adapter";
import { resolveMessengerTenant } from "@/lib/messaging/services/tenant-resolution.service";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";
import { logWebhookDelivery } from "@/lib/messaging/webhook-delivery-log.server";
import {
  verifyMetaWebhookSignature,
  validateWebhookVerifyToken,
} from "@/lib/messaging/services/platform-config.service";

function logInfo(message: string, data?: unknown) {
  console.log(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: unknown) {
  console.error(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

export const Route = createFileRoute("/api/public/facebook-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        logInfo("GET received", { mode, hasToken: Boolean(token) });

        if (mode === "subscribe" && token && (await validateWebhookVerifyToken(token))) {
          logInfo("GET validated");
          return new Response(challenge ?? "", { status: 200 });
        }

        logError("GET validation failed");
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        // 1. Authenticate Meta Signature on original raw body
        const sigResult = await verifyMetaWebhookSignature(rawBody, sig, "messenger");
        if (!sigResult.valid) {
          logError("Signature validation failed", { reason: sigResult.reason });
          await logWebhookDelivery({
            provider: "messenger",
            httpStatus: 403,
            outcome: "rejected_signature",
            rawBody: rawBody,
            errorMessage: `Signature validation failed: ${sigResult.reason}`,
          }).catch(() => {});
          return new Response("Forbidden (Invalid Signature)", { status: 403 });
        }

        let payload: unknown = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (e: any) {
          logError("JSON parsing failed", e.message);
          await logWebhookDelivery({
            provider: "messenger",
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
            provider: "messenger",
            httpStatus: 400,
            outcome: "rejected_unconfigured",
            rawBody: payload,
            errorMessage: "Meta page ID not found in payload",
          }).catch(() => {});
          return new Response("Page ID missing", { status: 400 });
        }

        const resolution = await resolveMessengerTenant(pageId);
        if (!resolution.resolved) {
          logError("Tenant not found for Facebook page", { pageId, reason: resolution.reason });
          await logWebhookDelivery({
            provider: "messenger",
            channelResourceId: pageId,
            httpStatus: 404,
            outcome: "rejected_unconfigured",
            rawBody: payload,
            errorMessage: `Tenant not found for Facebook page: ${resolution.reason}`,
          }).catch(() => {});
          return new Response("Page not integrated", { status: 404 });
        }

        const { events, diagnostics } = messengerAdapter.normalize(payload);
        logInfo("Adapter normalized events", { count: events.length, diagnostics });

        if (events.length === 0) {
          await logWebhookDelivery({
            provider: "messenger",
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
            provider: "messenger",
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
          provider: "messenger",
          tenantId: resolution.resolved!.tenantId,
          channelResourceId: pageId,
          httpStatus: 200,
          outcome: "queued",
          rawBody: payload,
        }).catch(() => {});
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
