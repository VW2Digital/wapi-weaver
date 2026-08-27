import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import { resolveInstagramTenant } from "@/lib/messaging/services/tenant-resolution.service";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";

function logInfo(message: string, data?: unknown) {
  console.log(`[instagram-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: unknown) {
  console.error(`[instagram-webhook] ${message}`, data ? JSON.stringify(data) : "");
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

export const Route = createFileRoute("/api/public/instagram-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        logInfo("GET received", { mode, token });

        if (mode === "subscribe" && token) {
          if (token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            logInfo("GET validated via env token");
            return new Response(challenge ?? "", { status: 200 });
          }
        }

        logError("GET validation failed");
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        logInfo("POST received", { hasSignature: !!sig, bytes: rawBody.length });

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

        // Resolve tenant from the Instagram page/account
        const resolution = await resolveInstagramTenant(pageId);
        if (!resolution.resolved) {
          logError("Tenant not found for Instagram page", { pageId, reason: resolution.reason });
          return new Response("Account not integrated", { status: 404 });
        }

        // Validate signature with the configured app secret
        const appSecret = process.env.META_APP_SECRET;
        if (appSecret) {
          const verified = await verifySignature(rawBody, sig, appSecret);
          if (!verified) {
            logError("Signature validation failed");
            return new Response("Forbidden (Invalid Signature)", { status: 403 });
          }
        }

        // Normalize and resolve tenant on each canonical event
        const { events, diagnostics } = instagramAdapter.normalize(payload);
        logInfo("Adapter normalized events", { count: events.length, diagnostics });

        if (events.length === 0) {
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        for (const event of events) {
          event.tenantId = resolution.resolved!.tenantId;
          event.userId = resolution.resolved!.userId;
        }

        // Persist canonical events idempotently
        const persisted = await persistCanonicalEvents(events);
        logInfo("Events persisted", { count: persisted.length });

        // Enqueue each new event for async processing
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
