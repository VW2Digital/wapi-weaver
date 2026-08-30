"use server";

import { createHmac, timingSafeEqual } from "crypto";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import type { CanonicalIdentity } from "@/lib/messaging/types";
import { resolveInstagramTenant } from "@/lib/messaging/services/tenant-resolution.service";
import { getInstagramChannelConfig } from "@/lib/messaging/services/channel.service";
import { getChannelConnectionByExternalAccount } from "@/lib/messaging/channel-connection.service";
import { getMetaAppConnectionById } from "@/lib/messaging/services/meta-app-connection.service";
import { fetchInstagramUserProfile } from "@/lib/instagram.functions";
import { persistCanonicalEvents } from "@/lib/messaging/event-store.server";
import { enqueueMessagingEvent } from "@/lib/queue/webhook-queue";
import { resolveMetaAppSecret } from "@/lib/messaging/services/platform-config.service";
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

import {
  verifyMetaWebhookSignature,
  validateWebhookVerifyToken,
} from "@/lib/messaging/services/platform-config.service";

export async function verifyInstagramWebhookSubscription(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): Promise<Response> {
  logInfo("GET verify request", { mode, hasToken: Boolean(token) });
  if (mode === "subscribe" && token && (await validateWebhookVerifyToken(token))) {
    logInfo("GET returning challenge", { hasChallenge: Boolean(challenge) });
    return new Response(challenge ?? "", { status: 200 });
  }

  logError("GET verification failed", { mode, hasToken: Boolean(token) });
  return new Response("Forbidden", { status: 403 });
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

  // 1. Authenticate Meta Signature on original raw body (usando o pageId/resourceId para buscar o secret em instagram_accounts caso não esteja em platform_settings)
  const sigResult = await verifyMetaWebhookSignature(rawBody, signature, "instagram", pageId);
  if (!sigResult.valid) {
    logError("Signature validation failed", { reason: sigResult.reason });
    await logWebhookDelivery({
      provider: "instagram",
      channelResourceId: pageId,
      httpStatus: 403,
      outcome: "rejected_signature",
      rawBody: rawBody,
      errorMessage: `Signature validation failed: ${sigResult.reason}`,
    }).catch(() => {});
    return new Response("Forbidden (Invalid Signature)", { status: 403 });
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

  const { events, diagnostics } = instagramAdapter.normalize(payload);

  const channelConfig = await getInstagramChannelConfig(
    resolution.resolved!.tenantId,
    pageId,
  );
  logInfo("Instagram channel config resolved", { hasConfig: Boolean(channelConfig), hasToken: Boolean(channelConfig?.accessToken), eventCount: events.length });
  if (channelConfig?.accessToken) {
    for (const event of events) {
      const message = event.payload as { sender?: CanonicalIdentity } | undefined;
      const senderId = message?.sender?.externalId;
      if (senderId) {
        try {
          logInfo("Fetching Instagram profile", { senderId });
          const profile = await fetchInstagramUserProfile(senderId, channelConfig.accessToken);
          logInfo("Instagram profile result", { senderId, name: profile?.name, hasPic: Boolean(profile?.profilePic) });
          if (profile?.name) {
            message.sender!.name = profile.name;
          }
          if (profile?.profilePic) {
            message.sender!.avatarUrl = profile.profilePic;
          }
        } catch (err: any) {
          logInfo("Could not fetch Instagram profile", { senderId, error: err.message });
        }
      }
    }
  }

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

  // For Instagram, channel_connections.external_account_id is the outbound send
  // node (page_id), while the webhook entry id is the IG business account id.
  // Resolve through the account's page_id so the two never diverge.
  const channel = await getChannelConnectionByExternalAccount(
    resolution.resolved!.tenantId,
    "instagram",
    resolution.resolved!.channelResourceId,
  );
  const metaApp = channel?.metaAppConnectionId ? await getMetaAppConnectionById(channel.metaAppConnectionId) : null;
  for (const event of events) {
    event.tenantId = resolution.resolved!.tenantId;
    event.userId = resolution.resolved!.userId;
    event.channelConnectionId = channel?.id ?? null;
    event.metaAppConnectionId = metaApp?.connectionId ?? null;
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
