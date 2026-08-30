import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { getMetaAppConnectionByPublicId } from "@/lib/messaging/services/meta-app-connection.service";
import { logWebhookDelivery } from "@/lib/messaging/webhook-delivery-log.server";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";
import { whatsappAdapter } from "@/lib/messaging/adapters/whatsapp.adapter";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import { messengerAdapter } from "@/lib/messaging/adapters/messenger.adapter";
import { getChannelConnectionByExternalAccount } from "@/lib/messaging/channel-connection.service";

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

        const connection = await getMetaAppConnectionByPublicId(publicId);
        if (!connection) {
          return new Response("Meta connection not found", { status: 404 });
        }

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

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (parseError: any) {
          return new Response("Bad Request", { status: 400 });
        }

        const objectType = payload?.object;
        let provider: "whatsapp" | "instagram" | "messenger" = "whatsapp";
        if (objectType === "instagram") {
          provider = "instagram";
        } else if (objectType === "page") {
          provider = "messenger";
        } else {
          provider = "whatsapp";
        }

        let resourceId: string | null = null;

        if (provider === "whatsapp") {
          const entry = payload?.entry?.[0];
          const change = entry?.changes?.[0];
          resourceId = change?.value?.metadata?.phone_number_id || null;
        } else if (provider === "instagram") {
          resourceId = payload?.entry?.[0]?.id || null;
        } else {
          resourceId = payload?.entry?.[0]?.id || null;
        }

        if (!resourceId) {
          return new Response(`missing resource id for provider ${provider}`, { status: 400 });
        }

        const channel = await getChannelConnectionByExternalAccount(
          connection.tenantId,
          provider,
          resourceId,
        );

        if (!channel) {
          await logWebhookDelivery({
            provider,
            tenantId: connection.tenantId,
            channelResourceId: resourceId,
            httpStatus: 404,
            outcome: "rejected_unconfigured",
            rawBody,
            errorMessage: `CHANNEL_NOT_FOUND: no ${provider} channel for resource ${resourceId}`,
          }).catch(() => {});
          return new Response(`Channel not found for resource ${resourceId}`, { status: 404 });
        }

        if (channel.tenantId !== connection.tenantId) {
          await logWebhookDelivery({
            provider,
            tenantId: connection.tenantId,
            channelResourceId: resourceId,
            httpStatus: 403,
            outcome: "rejected_unconfigured",
            rawBody,
            errorMessage: "SECURITY_CROSS_TENANT_ASSET_MISMATCH",
          }).catch(() => {});
          return new Response("Forbidden (Asset Cross-Tenant Mismatch)", { status: 403 });
        }

        if (channel.metaAppConnectionId && channel.metaAppConnectionId !== connection.connectionId) {
          await logWebhookDelivery({
            provider,
            tenantId: connection.tenantId,
            channelResourceId: resourceId,
            httpStatus: 403,
            outcome: "rejected_unconfigured",
            rawBody,
            errorMessage: "SECURITY_META_APP_MISMATCH",
          }).catch(() => {});
          return new Response("Forbidden (Meta App Mismatch)", { status: 403 });
        }

        if (channel.status !== "active") {
          await logWebhookDelivery({
            provider,
            tenantId: connection.tenantId,
            channelResourceId: resourceId,
            httpStatus: 403,
            outcome: "rejected_unconfigured",
            rawBody,
            errorMessage: `CHANNEL_${channel.status.toUpperCase()}_NOT_ACTIVE`,
          }).catch(() => {});
          return new Response(`Channel ${channel.id} is not active`, { status: 403 });
        }

        const adapter = provider === "whatsapp" ? whatsappAdapter : provider === "instagram" ? instagramAdapter : messengerAdapter;
        const { events } = adapter.normalize(payload);
        for (const ev of events) {
          ev.tenantId = connection.tenantId;
          ev.userId = connection.tenantId;
          ev.channelResourceId = resourceId;
          ev.channelConnectionId = channel.id;
          ev.metaAppConnectionId = connection.connectionId;
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
          provider,
          tenantId: connection.tenantId,
          channelResourceId: resourceId,
          httpStatus: 200,
          outcome: "queued",
          rawBody: payload,
        }).catch(() => {});

        return new Response("ok", { status: 200 });
      },
    },
  },
});
