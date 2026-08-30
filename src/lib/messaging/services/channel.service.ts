"use server";

import db from "@/lib/db";
import { decryptMetaCredential } from "@/lib/encryption";
import type { MessagingProvider } from "../types";

export interface WhatsAppChannelConfig {
  channelConnectionId: string | null;
  tenantId: string;
  userId: string;
  provider: "whatsapp";
  phoneNumberId: string;
  wabaId: string | null;
  appId: string | null;
  appSecret: string | null;
  accessToken: string | null;
  graphVersion: string;
  displayPhoneNumber: string | null;
  architecture: "v3" | "legacy";
}

export interface InstagramChannelConfig {
  channelConnectionId: string | null;
  tenantId: string;
  userId: string;
  provider: "instagram";
  pageId: string | null;
  instagramBusinessAccountId: string | null;
  igUserId: string | null;
  accessToken: string | null;
  appSecret: string | null;
  graphVersion: string;
  architecture: "v3" | "legacy";
}

export interface MessengerChannelConfig {
  channelConnectionId: string | null;
  tenantId: string;
  userId: string;
  provider: "messenger";
  pageId: string;
  pageAccessToken: string | null;
  appSecret: string | null;
  graphVersion: string;
  architecture: "v3" | "legacy";
}

export type ChannelConfig = WhatsAppChannelConfig | InstagramChannelConfig | MessengerChannelConfig;

const DEFAULT_GRAPH_VERSION = "v26.0";

/**
 * Resolve WhatsApp channel configuration V3-first.
 * If a V3 channel_connection exists, use meta_app_connection credentials.
 * Otherwise, fall back to legacy `profiles` only when no V3 record exists.
 */
export async function getWhatsAppChannelConfig(
  tenantId: string,
  phoneNumberId: string,
): Promise<WhatsAppChannelConfig | null> {
  // V3 lookup
  const v3Rows = (await db.query(
    `SELECT
       cc.id AS channel_id,
       cc.tenant_id,
       cc.external_account_id,
       cc.metadata,
       cc.access_token_encrypted,
       mac.id AS meta_app_connection_id,
       mac.app_id,
       mac.app_secret_encrypted,
       mac.graph_version
     FROM channel_connections cc
     JOIN meta_app_connections mac ON mac.id = cc.meta_app_connection_id
     WHERE cc.tenant_id = ?
       AND cc.provider = 'whatsapp'
       AND cc.external_account_id = ?
       AND mac.status = 'active'
     LIMIT 1`,
    [tenantId, phoneNumberId],
  )) as Array<{
    channel_id: string;
    tenant_id: string;
    external_account_id: string;
    metadata: any;
    access_token_encrypted: string | null;
    meta_app_connection_id: string;
    app_id: string;
    app_secret_encrypted: string;
    graph_version: string;
  }>;

  const v3 = v3Rows[0];
  if (v3) {
    const metadata = typeof v3.metadata === "string" ? JSON.parse(v3.metadata) : v3.metadata || {};
    let appSecret = "";
    let accessToken = "";
    try {
      appSecret = decryptMetaCredential(v3.app_secret_encrypted);
    } catch (err) {
      console.error(`[channel.service] V3 Meta App secret decrypt failed for tenant ${tenantId}:`, err);
      return null;
    }
    if (v3.access_token_encrypted) {
      try {
        accessToken = decryptMetaCredential(v3.access_token_encrypted);
      } catch (err) {
        console.error(`[channel.service] V3 WhatsApp access token decrypt failed for tenant ${tenantId}:`, err);
      }
    }
    return {
      channelConnectionId: v3.channel_id,
      tenantId: v3.tenant_id,
      userId: v3.tenant_id,
      provider: "whatsapp",
      phoneNumberId: v3.external_account_id,
      wabaId: metadata?.waba_id || null,
      appId: v3.app_id,
      appSecret,
      accessToken,
      graphVersion: v3.graph_version || DEFAULT_GRAPH_VERSION,
      displayPhoneNumber: metadata?.display_phone_number || null,
      architecture: "v3",
    };
  }

  // LEGACY fallback only when no V3 record exists
  const rows = (await db.query(
    `SELECT
       id,
       whatsapp_phone_number_id AS phoneNumberId,
       whatsapp_waba_id AS wabaId,
       whatsapp_app_id AS appId,
       whatsapp_app_secret AS appSecret,
       whatsapp_access_token AS accessToken,
       meta_graph_version AS graphVersion,
       whatsapp_business_phone AS displayPhoneNumber
     FROM profiles
     WHERE id = ? AND whatsapp_phone_number_id = ?
     LIMIT 1`,
    [tenantId, phoneNumberId],
  )) as Array<{
    id: string;
    phoneNumberId: string;
    wabaId: string | null;
    appId: string | null;
    appSecret: string | null;
    accessToken: string | null;
    graphVersion: string | null;
    displayPhoneNumber: string | null;
  }>;

  const profile = rows[0];
  if (!profile) return null;

  return {
    channelConnectionId: null,
    tenantId: profile.id,
    userId: profile.id,
    provider: "whatsapp",
    phoneNumberId: profile.phoneNumberId,
    wabaId: profile.wabaId,
    appId: profile.appId,
    appSecret: profile.appSecret,
    accessToken: profile.accessToken,
    graphVersion: profile.graphVersion || DEFAULT_GRAPH_VERSION,
    displayPhoneNumber: profile.displayPhoneNumber,
    architecture: "legacy",
  };
}

export async function getInstagramChannelConfig(
  tenantId: string,
  resourceId: string,
): Promise<InstagramChannelConfig | null> {
  const v3Rows = (await db.query(
    `SELECT
       cc.id AS channel_id,
       cc.tenant_id,
       cc.external_account_id,
       cc.metadata,
       cc.access_token_encrypted,
       mac.id AS meta_app_connection_id,
       mac.app_id,
       mac.app_secret_encrypted,
       mac.graph_version
     FROM channel_connections cc
     JOIN meta_app_connections mac ON mac.id = cc.meta_app_connection_id
     WHERE cc.tenant_id = ?
       AND cc.provider = 'instagram'
       AND cc.external_account_id = ?
     LIMIT 1`,
    [tenantId, resourceId],
  )) as Array<{
    channel_id: string;
    tenant_id: string;
    external_account_id: string;
    metadata: any;
    access_token_encrypted: string | null;
    meta_app_connection_id: string;
    app_id: string;
    app_secret_encrypted: string;
    graph_version: string;
  }>;

  const v3 = v3Rows[0];
  if (v3) {
    const metadata = typeof v3.metadata === "string" ? JSON.parse(v3.metadata) : v3.metadata || {};
    let appSecret = "";
    let accessToken = "";
    try {
      appSecret = decryptMetaCredential(v3.app_secret_encrypted);
    } catch (err) {
      console.error(`[channel.service] V3 Meta App secret decrypt failed for tenant ${tenantId}:`, err);
      return null;
    }
    if (v3.access_token_encrypted) {
      try {
        accessToken = decryptMetaCredential(v3.access_token_encrypted);
      } catch (err) {
        console.error(`[channel.service] V3 Instagram access token decrypt failed for tenant ${tenantId}:`, err);
      }
    }
    return {
      channelConnectionId: v3.channel_id,
      tenantId: v3.tenant_id,
      userId: v3.tenant_id,
      provider: "instagram",
      pageId: metadata?.page_id || null,
      instagramBusinessAccountId: metadata?.instagram_business_account_id || v3.external_account_id,
      igUserId: v3.external_account_id,
      accessToken,
      appSecret,
      graphVersion: v3.graph_version || DEFAULT_GRAPH_VERSION,
      architecture: "v3",
    };
  }

  const rows = (await db.query(
    `SELECT
       tenant_id,
       user_id,
       page_id,
       instagram_business_account_id,
       ig_user_id,
       access_token,
       app_secret
     FROM instagram_accounts
     WHERE tenant_id = ? AND (page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?)
     LIMIT 1`,
    [tenantId, resourceId, resourceId, resourceId],
  )) as Array<{
    tenant_id: string;
    user_id: string;
    page_id: string | null;
    instagram_business_account_id: string | null;
    ig_user_id: string | null;
    access_token: string | null;
    app_secret: string | null;
  }>;

  const account = rows[0];
  if (!account) return null;

  return {
    channelConnectionId: null,
    tenantId: account.tenant_id,
    userId: account.user_id,
    provider: "instagram",
    pageId: account.page_id,
    instagramBusinessAccountId: account.instagram_business_account_id,
    igUserId: account.ig_user_id,
    accessToken: account.access_token,
    appSecret: account.app_secret,
    graphVersion: DEFAULT_GRAPH_VERSION,
    architecture: "legacy",
  };
}

export async function getMessengerChannelConfig(
  tenantId: string,
  pageId: string,
): Promise<MessengerChannelConfig | null> {
  const rows = (await db.query(
    `SELECT user_id, page_id, page_access_token
     FROM facebook_pages
     WHERE user_id = ? AND page_id = ?
     LIMIT 1`,
    [tenantId, pageId],
  )) as Array<{
    user_id: string;
    page_id: string;
    page_access_token: string | null;
  }>;

  const page = rows[0];
  if (!page) return null;

  return {
    channelConnectionId: null,
    tenantId: page.user_id,
    userId: page.user_id,
    provider: "messenger",
    pageId: page.page_id,
    pageAccessToken: page.page_access_token,
    appSecret: null,
    graphVersion: DEFAULT_GRAPH_VERSION,
    architecture: "legacy",
  };
}

export interface ChannelHealthStatus {
  provider: "whatsapp" | "instagram" | "messenger";
  status: "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "ERROR" | "DISCONNECTED";
  credentialsConfigured: boolean;
  assetResolved: boolean;
  tenantResolved: boolean;
  webhookHealthy: boolean;
  lastWebhookAt?: string | null;
  lastSuccessfulMessageAt?: string | null;
  lastError?: string | null;
}

export async function getChannelHealthDiagnostic(
  tenantId: string,
  provider: "whatsapp" | "instagram" | "messenger",
): Promise<ChannelHealthStatus> {
  let credentialsConfigured = false;
  let assetResolved = false;
  let tenantResolved = Boolean(tenantId);
  let webhookHealthy = true;
  let lastWebhookAt: string | null = null;
  let lastSuccessfulMessageAt: string | null = null;
  let lastError: string | null = null;

  if (provider === "whatsapp") {
    const v3Rows = (await db.query(
      `SELECT cc.id, cc.status, cc.external_account_id, mac.app_secret_encrypted, cc.access_token_encrypted
       FROM channel_connections cc
       JOIN meta_app_connections mac ON mac.id = cc.meta_app_connection_id
       WHERE cc.tenant_id = ? AND cc.provider = 'whatsapp'
       LIMIT 1`,
      [tenantId],
    )) as Array<{ id: string; status: string; external_account_id: string; app_secret_encrypted: string; access_token_encrypted: string }>;

    if (v3Rows[0]) {
      assetResolved = Boolean(v3Rows[0].external_account_id);
      let hasSecret = false;
      let hasToken = false;
      try {
        decryptMetaCredential(v3Rows[0].app_secret_encrypted);
        hasSecret = true;
      } catch {}
      if (v3Rows[0].access_token_encrypted) {
        try {
          decryptMetaCredential(v3Rows[0].access_token_encrypted);
          hasToken = true;
        } catch {}
      }
      credentialsConfigured = hasSecret || hasToken;
    } else {
      const rows = (await db.query(
        "SELECT id, whatsapp_phone_number_id, whatsapp_access_token FROM profiles WHERE id = ? LIMIT 1",
        [tenantId],
      )) as Array<{ id: string; whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null }>;
      const profile = rows[0];
      credentialsConfigured = Boolean(profile?.whatsapp_access_token);
      assetResolved = Boolean(profile?.whatsapp_phone_number_id);
    }
  } else if (provider === "instagram") {
    const rows = (await db.query(
      "SELECT id, page_id, instagram_business_account_id, access_token, status FROM instagram_accounts WHERE tenant_id = ? LIMIT 1",
      [tenantId],
    )) as Array<{ id: string; page_id: string | null; instagram_business_account_id: string | null; access_token: string | null; status: string }>;
    const acc = rows[0];
    credentialsConfigured = Boolean(acc?.access_token);
    assetResolved = Boolean(acc?.page_id && acc?.instagram_business_account_id);
  } else if (provider === "messenger") {
    const rows = (await db.query(
      "SELECT page_id, page_access_token FROM facebook_pages WHERE user_id = ? LIMIT 1",
      [tenantId],
    )) as Array<{ page_id: string; page_access_token: string | null }>;
    const page = rows[0];
    credentialsConfigured = Boolean(page?.page_access_token);
    assetResolved = Boolean(page?.page_id);
  }

  // Buscar última mensagem com sucesso
  const msgRows = (await db.query(
    "SELECT created_at FROM direct_messages WHERE tenant_id = ? AND channel = ? ORDER BY created_at DESC LIMIT 1",
    [tenantId, provider],
  )) as Array<{ created_at: Date }>;
  if (msgRows[0]?.created_at) {
    lastSuccessfulMessageAt = msgRows[0].created_at.toISOString();
  }

  // Buscar último webhook
  const logRows = (await db.query(
    "SELECT created_at, http_status, error_message FROM webhook_delivery_logs WHERE tenant_id = ? AND provider = ? ORDER BY created_at DESC LIMIT 1",
    [tenantId, provider],
  )) as Array<{ created_at: Date; http_status: number; error_message: string | null }>;
  if (logRows[0]) {
    lastWebhookAt = logRows[0].created_at ? new Date(logRows[0].created_at).toISOString() : null;
    if (logRows[0].http_status >= 400) {
      webhookHealthy = false;
      lastError = logRows[0].error_message;
    }
  }

  const isConnected = credentialsConfigured && assetResolved && tenantResolved;
  const status: ChannelHealthStatus["status"] = !credentialsConfigured
    ? "DISCONNECTED"
    : isConnected
      ? webhookHealthy
        ? "CONNECTED"
        : "DEGRADED"
      : "ERROR";

  return {
    provider,
    status,
    credentialsConfigured,
    assetResolved,
    tenantResolved,
    webhookHealthy,
    lastWebhookAt,
    lastSuccessfulMessageAt,
    lastError,
  };
}

export async function getChannelConfig(
  provider: MessagingProvider,
  tenantId: string,
  resourceId: string,
): Promise<ChannelConfig | null> {
  switch (provider) {
    case "whatsapp":
      return getWhatsAppChannelConfig(tenantId, resourceId);
    case "instagram":
      return getInstagramChannelConfig(tenantId, resourceId);
    case "messenger":
      return getMessengerChannelConfig(tenantId, resourceId);
    default:
      return null;
  }
}
