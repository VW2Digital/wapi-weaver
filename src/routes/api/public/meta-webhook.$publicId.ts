import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { getMetaAppConnectionByPublicId } from "@/lib/messaging/services/meta-app-connection.service";
import { logWebhookDelivery } from "@/lib/messaging/webhook-delivery-log.server";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";
import { whatsappAdapter } from "@/lib/messaging/adapters/whatsapp.adapter";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import { messengerAdapter } from "@/lib/messaging/adapters/messenger.adapter";
import { processInstagramWebhook } from "@/lib/messaging/webhook-handlers/instagram.handler";
import db from "@/lib/db";

function timingSafeMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyHmacSignature(rawBody: string, signatureHeader: string | null, appSecret: string): { valid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { valid: false, reason: "missing_signature" };
  }

  const expectedSig = `sha256=${createHmac("sha256", appSecret).update(Buffer.from(rawBody, "utf8")).digest("hex")}`;
  if (!timingSafeMatch(signatureHeader, expectedSig)) {
    return { valid: false, reason: "invalid_signature" };
  }

  return { valid: true };
}

export const Route = createFileRoute("/api/public/meta-webhook/$publicId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publicId = params.publicId;
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (!publicId) {
          return new Response("Public ID missing", { status: 400 });
        }

        const connection = await getMetaAppConnectionByPublicId(publicId);
        if (!connection) {
          return new Response("Meta connection not found", { status: 404 });
        }

        if (mode === "subscribe" && token && timingSafeMatch(token, connection.webhookVerifyToken)) {
          return new Response(challenge ?? "", { status: 200 });
        }

        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ params, request }) => {
        const publicId = params.publicId;
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        if (!publicId) {
          return new Response("Public ID missing", { status: 400 });
        }

        // 1. Resolve Meta App Connection by public_id BEFORE parsing payload
        const connection = await getMetaAppConnectionByPublicId(publicId);
        if (!connection) {
          return new Response("Meta connection not found", { status: 404 });
        }

        // 2. Validate HMAC SHA-256 on original raw body using decrypted app_secret
        const sigResult = verifyHmacSignature(rawBody, sig, connection.appSecret);
        if (!sigResult.valid) {
          await logWebhookDelivery({
            provider: "whatsapp",
            tenantId: connection.tenantId,
            httpStatus: 403,
            outcome: "rejected_signature",
            rawBody,
            errorMessage: `V3 Signature validation failed: ${sigResult.reason}`,
          }).catch(() => {});
          return new Response("Forbidden (Invalid Signature)", { status: 403 });
        }

        // 3. Parse JSON only after HMAC verification
        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (parseError: any) {
          return new Response("Bad Request", { status: 400 });
        }

        // 4. Detect provider
        const objectType = payload?.object;
        let provider: "whatsapp" | "instagram" | "messenger" = "whatsapp";
        if (objectType === "instagram") {
          provider = "instagram";
        } else if (objectType === "page") {
          provider = "messenger";
        } else {
          provider = "whatsapp";
        }

        // 5. Asset resolution & Tenant cross-check
        if (provider === "whatsapp") {
          const entry = payload?.entry?.[0];
          const change = entry?.changes?.[0];
          const phoneNumberId = change?.value?.metadata?.phone_number_id;

          if (!phoneNumberId) {
            return new Response("phone_number_id missing", { status: 400 });
          }

          // Cross-check: verify asset ownership in channel_connections if registered
          const channelRows = await db.query<Array<any>>(
            `SELECT tenant_id, meta_app_connection_id FROM channel_connections
             WHERE provider = 'whatsapp' AND external_account_id = ?
             LIMIT 1`,
            [phoneNumberId],
          );
          const channel = channelRows?.[0];
          if (channel) {
            if (channel.tenant_id !== connection.tenantId || (channel.meta_app_connection_id && channel.meta_app_connection_id !== connection.connectionId)) {
              await logWebhookDelivery({
                provider: "whatsapp",
                tenantId: connection.tenantId,
                channelResourceId: phoneNumberId,
                httpStatus: 403,
                outcome: "rejected_unconfigured",
                rawBody,
                errorMessage: "SECURITY_CROSS_TENANT_ASSET_MISMATCH",
              }).catch(() => {});
              return new Response("Forbidden (Asset Cross-Tenant Mismatch)", { status: 403 });
            }
          }

          // Normalize
          const { events } = whatsappAdapter.normalize(payload);
          for (const ev of events) {
            ev.tenantId = connection.tenantId;
            ev.userId = connection.tenantId;
            ev.channelResourceId = phoneNumberId;
          }

          if (events.length > 0) {
            const persisted = await persistCanonicalEvents(events);
            for (const item of persisted) {
              if (!item.skipped) {
                await enqueueMessagingEvent(item.eventId);
              }
            }
          }

          await logWebhookDelivery({
            provider: "whatsapp",
            tenantId: connection.tenantId,
            channelResourceId: phoneNumberId,
            httpStatus: 200,
            outcome: "queued",
            rawBody: payload,
          }).catch(() => {});

          return new Response("ok", { status: 200 });
        }

        if (provider === "instagram") {
          const entryId = payload?.entry?.[0]?.id;

          if (entryId) {
            const channelRows = await db.query<Array<any>>(
              `SELECT tenant_id, meta_app_connection_id FROM channel_connections
               WHERE provider = 'instagram' AND external_account_id = ?
               LIMIT 1`,
              [entryId],
            );
            const channel = channelRows?.[0];
            if (channel) {
              if (channel.tenant_id !== connection.tenantId || (channel.meta_app_connection_id && channel.meta_app_connection_id !== connection.connectionId)) {
                await logWebhookDelivery({
                  provider: "instagram",
                  tenantId: connection.tenantId,
                  channelResourceId: entryId,
                  httpStatus: 403,
                  outcome: "rejected_unconfigured",
                  rawBody,
                  errorMessage: "SECURITY_CROSS_TENANT_ASSET_MISMATCH",
                }).catch(() => {});
                return new Response("Forbidden (Asset Cross-Tenant Mismatch)", { status: 403 });
              }
            }
          }

          const { events } = instagramAdapter.normalize(payload);
          for (const ev of events) {
            ev.tenantId = connection.tenantId;
            ev.userId = connection.tenantId;
            ev.channelResourceId = entryId || "";
          }

          if (events.length > 0) {
            const persisted = await persistCanonicalEvents(events);
            for (const item of persisted) {
              if (!item.skipped) {
                await enqueueMessagingEvent(item.eventId);
              }
            }
          }

          await logWebhookDelivery({
            provider: "instagram",
            tenantId: connection.tenantId,
            channelResourceId: entryId,
            httpStatus: 200,
            outcome: "queued",
            rawBody: payload,
          }).catch(() => {});

          return new Response("ok", { status: 200 });
        }

        // Messenger
        const pageId = payload?.entry?.[0]?.id;
        if (pageId) {
          const channelRows = await db.query<Array<any>>(
            `SELECT tenant_id, meta_app_connection_id FROM channel_connections
             WHERE provider = 'messenger' AND external_account_id = ?
             LIMIT 1`,
            [pageId],
          );
          const channel = channelRows?.[0];
          if (channel) {
            if (channel.tenant_id !== connection.tenantId || (channel.meta_app_connection_id && channel.meta_app_connection_id !== connection.connectionId)) {
              await logWebhookDelivery({
                provider: "messenger",
                tenantId: connection.tenantId,
                channelResourceId: pageId,
                httpStatus: 403,
                outcome: "rejected_unconfigured",
                rawBody,
                errorMessage: "SECURITY_CROSS_TENANT_ASSET_MISMATCH",
              }).catch(() => {});
              return new Response("Forbidden (Asset Cross-Tenant Mismatch)", { status: 403 });
            }
          }
        }

        const { events } = messengerAdapter.normalize(payload);
        for (const ev of events) {
          ev.tenantId = connection.tenantId;
          ev.userId = connection.tenantId;
          ev.channelResourceId = pageId || "";
        }

        if (events.length > 0) {
          const persisted = await persistCanonicalEvents(events);
          for (const item of persisted) {
            if (!item.skipped) {
              await enqueueMessagingEvent(item.eventId);
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
