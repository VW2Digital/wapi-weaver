import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { messengerAdapter } from "@/lib/messaging/adapters/messenger.adapter";
import { resolveMessengerTenant } from "@/lib/messaging/services/tenant-resolution.service";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";

function logInfo(message: string, data?: unknown) {
  console.log(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: unknown) {
  console.error(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
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

export const Route = createFileRoute("/api/public/facebook-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        logInfo("GET received", { mode, token });

        const verifyToken =
          process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

        if (mode === "subscribe" && token === verifyToken) {
          logInfo("GET validated");
          return new Response(challenge ?? "", { status: 200 });
        }

        logError("GET validation failed");
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        let payload: unknown = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (e: any) {
          logError("JSON parsing failed", e.message);
          return new Response("Bad Request", { status: 400 });
        }

        const pageId = (payload as any)?.entry?.[0]?.id;
        if (!pageId) {
          logError("Meta page ID not found in payload");
          return new Response("Page ID missing", { status: 400 });
        }

        const resolution = await resolveMessengerTenant(pageId);
        if (!resolution.resolved) {
          logError("Tenant not found for Facebook page", { pageId, reason: resolution.reason });
          return new Response("Page not integrated", { status: 404 });
        }

        const appSecret = process.env.META_APP_SECRET;
        if (appSecret) {
          const verified = await verifySignature(rawBody, sig, appSecret);
          if (!verified) {
            logError("Signature validation failed");
            return new Response("Forbidden (Invalid Signature)", { status: 403 });
          }
        }

        const { events, diagnostics } = messengerAdapter.normalize(payload);
        logInfo("Adapter normalized events", { count: events.length, diagnostics });

        if (events.length === 0) {
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        for (const event of events) {
          event.tenantId = resolution.resolved!.tenantId;
          event.userId = resolution.resolved!.userId;
        }

        const persisted = await persistCanonicalEvents(events);
        logInfo("Events persisted", { count: persisted.length });

        for (const result of persisted) {
          if (!result.skipped) {
            await enqueueMessagingEvent(result.eventId);
          }
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
