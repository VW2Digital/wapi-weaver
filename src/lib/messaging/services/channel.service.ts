"use server";

import db from "@/lib/db";
import type { MessagingProvider } from "../types";

export interface WhatsAppChannelConfig {
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
}

export interface InstagramChannelConfig {
  tenantId: string;
  userId: string;
  provider: "instagram";
  pageId: string | null;
  instagramBusinessAccountId: string | null;
  igUserId: string | null;
  accessToken: string | null;
  appSecret: string | null;
  graphVersion: string;
}

export interface MessengerChannelConfig {
  tenantId: string;
  userId: string;
  provider: "messenger";
  pageId: string;
  pageAccessToken: string | null;
  appSecret: string | null;
  graphVersion: string;
}

export type ChannelConfig = WhatsAppChannelConfig | InstagramChannelConfig | MessengerChannelConfig;

const DEFAULT_GRAPH_VERSION = "v26.0";

export async function getWhatsAppChannelConfig(
  tenantId: string,
  phoneNumberId: string,
): Promise<WhatsAppChannelConfig | null> {
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
  };
}

export async function getInstagramChannelConfig(
  tenantId: string,
  resourceId: string,
): Promise<InstagramChannelConfig | null> {
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
    tenantId: account.tenant_id,
    userId: account.user_id,
    provider: "instagram",
    pageId: account.page_id,
    instagramBusinessAccountId: account.instagram_business_account_id,
    igUserId: account.ig_user_id,
    accessToken: account.access_token,
    appSecret: account.app_secret,
    graphVersion: DEFAULT_GRAPH_VERSION,
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
    tenantId: page.user_id,
    userId: page.user_id,
    provider: "messenger",
    pageId: page.page_id,
    pageAccessToken: page.page_access_token,
    appSecret: process.env.META_APP_SECRET || null,
    graphVersion: DEFAULT_GRAPH_VERSION,
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
    const rows = (await db.query(
      "SELECT id, whatsapp_phone_number_id, whatsapp_access_token FROM profiles WHERE id = ? LIMIT 1",
      [tenantId],
    )) as Array<{ id: string; whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null }>;
    const profile = rows[0];
    credentialsConfigured = Boolean(profile?.whatsapp_access_token);
    assetResolved = Boolean(profile?.whatsapp_phone_number_id);
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
