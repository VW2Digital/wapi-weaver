"use server";

import db from "@/lib/db";
import type { MessagingProvider } from "../types";

export interface ResolvedTenant {
  tenantId: string;
  userId: string;
  channelResourceId: string;
  channelType: MessagingProvider;
}

export interface TenantResolutionResult {
  resolved: ResolvedTenant | null;
  reason: string;
}

export async function resolveWhatsAppTenant(
  phoneNumberId: string,
): Promise<TenantResolutionResult> {
  if (!phoneNumberId) {
    return { resolved: null, reason: "missing_phone_number_id" };
  }

  const rows = (await db.query(
    `SELECT id, whatsapp_phone_number_id AS phoneNumberId
     FROM profiles
     WHERE whatsapp_phone_number_id = ?
     LIMIT 2`,
    [phoneNumberId],
  )) as Array<{ id: string; phoneNumberId: string }>;

  if (rows.length === 0) {
    return { resolved: null, reason: "phone_number_id_not_found" };
  }

  if (rows.length > 1) {
    return { resolved: null, reason: "ambiguous_phone_number_id" };
  }

  const profile = rows[0];
  return {
    resolved: {
      tenantId: profile.id,
      userId: profile.id,
      channelResourceId: profile.phoneNumberId,
      channelType: "whatsapp",
    },
    reason: "phone_number_id",
  };
}

export async function resolveInstagramTenant(
  resourceId: string,
): Promise<TenantResolutionResult> {
  if (!resourceId) {
    return { resolved: null, reason: "missing_resource_id" };
  }

  const rows = (await db.query(
    `SELECT tenant_id, user_id, page_id, instagram_business_account_id, ig_user_id
     FROM instagram_accounts
     WHERE page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?
     LIMIT 2`,
    [resourceId, resourceId, resourceId],
  )) as Array<{
    tenant_id: string;
    user_id: string;
    page_id: string;
    instagram_business_account_id: string;
    ig_user_id: string;
  }>;

  if (rows.length === 0) {
    return { resolved: null, reason: "instagram_account_not_found" };
  }

  if (rows.length > 1) {
    return { resolved: null, reason: "ambiguous_instagram_account" };
  }

  const account = rows[0];
  return {
    resolved: {
      tenantId: account.tenant_id,
      userId: account.user_id,
      channelResourceId:
        account.page_id || account.instagram_business_account_id || account.ig_user_id,
      channelType: "instagram",
    },
    reason: "instagram_account",
  };
}

export async function resolveMessengerTenant(
  pageId: string,
): Promise<TenantResolutionResult> {
  if (!pageId) {
    return { resolved: null, reason: "missing_page_id" };
  }

  const rows = (await db.query(
    `SELECT user_id, page_id FROM facebook_pages WHERE page_id = ? LIMIT 2`,
    [pageId],
  )) as Array<{ user_id: string; page_id: string }>;

  if (rows.length === 0) {
    return { resolved: null, reason: "facebook_page_not_found" };
  }

  if (rows.length > 1) {
    return { resolved: null, reason: "ambiguous_facebook_page" };
  }

  const page = rows[0];
  return {
    resolved: {
      tenantId: page.user_id,
      userId: page.user_id,
      channelResourceId: page.page_id,
      channelType: "messenger",
    },
    reason: "facebook_page",
  };
}

export async function resolveTenant(
  provider: MessagingProvider,
  resourceId: string,
): Promise<TenantResolutionResult> {
  switch (provider) {
    case "whatsapp":
      return resolveWhatsAppTenant(resourceId);
    case "instagram":
      return resolveInstagramTenant(resourceId);
    case "messenger":
      return resolveMessengerTenant(resourceId);
    default:
      return { resolved: null, reason: "unknown_provider" };
  }
}
