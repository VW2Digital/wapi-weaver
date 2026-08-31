"use server";

import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import db, { transaction } from "@/lib/db";
import type { CanonicalIdentity, MessagingProvider } from "../types";
import { getInstagramChannelConfig } from "./channel.service";
import { InstagramProfileEnrichmentService } from "./instagram-profile-enrichment.service";

export interface EnsureContactOptions {
  tenantId: string;
  userId: string;
  provider: MessagingProvider;
  identity: CanonicalIdentity;
  /** Display phone for WhatsApp; placeholder for Instagram/Messenger/WebChat. */
  phoneE164: string | null;
  source?: string;
  markUnread?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface EnsureContactResult {
  contactId: string;
  isNew: boolean;
}

function buildContactName(identity: CanonicalIdentity, provider: MessagingProvider): string {
  if (identity.name) return identity.name;
  if (provider === "whatsapp") return `WhatsApp (${identity.phoneE164 || identity.externalId})`;
  if (provider === "instagram") return `Instagram (${identity.externalId})`;
  if (provider === "messenger") return `Facebook (${identity.externalId})`;
  if (provider === "webchat") return `Visitante WebChat (${identity.externalId})`;
  return `Contato (${identity.externalId})`;
}

function isInstagramPlaceholderName(value: string): boolean {
  if (!value || typeof value !== "string") return true;
  const lower = value.toLowerCase().trim();
  return lower.startsWith("instagram (") || lower.startsWith("ig_") || lower.startsWith("contato (") || lower.startsWith("facebook (") || lower === "instagram";
}

async function maybeEnrichInstagramIdentity(
  tenantId: string,
  identity: CanonicalIdentity,
): Promise<CanonicalIdentity> {
  if (!identity || !identity.externalId || !identity.metadata?.recipientId) {
    return identity;
  }

  const enriched = (identity.metadata as Record<string, unknown>)?.enriched;
  const instagramProfileName = (identity.metadata as Record<string, unknown>)?.instagram_profile_name;

  // If a real name was already provided by the protected webhook handler,
  // trust it and avoid a redundant second profile lookup.
  if (identity.name && !isInstagramPlaceholderName(identity.name) && (instagramProfileName || enriched)) {
    return identity;
  }

  try {
    const channelConfig = await getInstagramChannelConfig(
      tenantId,
      String(identity.metadata.recipientId),
    );
    if (!channelConfig?.accessToken) return identity;

    const service = new InstagramProfileEnrichmentService(channelConfig.graphVersion);
    const profile = await service.fetchProfile(identity.externalId, channelConfig.accessToken);
    if (!profile) return identity;

    const displayName = profile.name ?? profile.username ?? identity.name ?? undefined;

    return {
      ...identity,
      name: displayName,
      avatarUrl: profile.profilePic ?? identity.avatarUrl ?? null,
      metadata: {
        ...(identity.metadata ?? {}),
        enriched: true,
        instagram_profile_name: profile.name ?? null,
        instagram_username: profile.username ?? null,
      },
    };
  } catch {
    return identity;
  }
}

export async function ensureContact(
  options: EnsureContactOptions,
): Promise<EnsureContactResult> {
  const {
    tenantId,
    userId,
    provider,
    identity,
    phoneE164,
    source = `${provider}_inbound`,
    markUnread = true,
    metadata = null,
  } = options;

  const enrichedIdentity =
    provider === "instagram" ? await maybeEnrichInstagramIdentity(tenantId, identity) : identity;

  const name = buildContactName(enrichedIdentity, provider);
  const instagramProfileName = (enrichedIdentity.metadata as Record<string, unknown> | null)?.instagram_profile_name;
  const instagramUsername = (enrichedIdentity.metadata as Record<string, unknown> | null)?.instagram_username;
  const customFields: Record<string, unknown> = {
    ...(metadata ?? {}),
    avatar_url: enrichedIdentity.avatarUrl ?? undefined,
    ...(provider === "instagram"
      ? {
          instagram_profile_name: typeof instagramProfileName === "string" ? instagramProfileName : undefined,
          instagram_username: typeof instagramUsername === "string" ? instagramUsername : undefined,
        }
      : {}),
  };

  return transaction(async (conn) => {
    // 1. Try to resolve the contact by its external identity first.
    // This makes the system robust when a contact has the same Instagram/Facebook
    // account linked to different phone numbers, or when a phone number changes.
    const [identityRows] = await conn.execute(
      `SELECT contact_id FROM contact_identities
       WHERE user_id = ? AND provider = ? AND external_id = ?
       LIMIT 1`,
      [userId, provider, identity.externalId],
    );

    const existingContactByIdentity = (identityRows as Array<{ contact_id: string }>)?.[0]?.contact_id;

    // 2. Upsert contact by (user_id, phone_e164)
    const contactId = existingContactByIdentity ?? randomUUID();
    const channel =
      provider === "whatsapp"
        ? "whatsapp"
        : provider === "instagram"
          ? "instagram"
          : provider === "webchat"
            ? "webchat"
            : "messenger";
    const instagramId = provider === "instagram" ? identity.externalId : null;
    const whatsappNumber = provider === "whatsapp" ? (identity.phoneE164 || phoneE164) : null;

    const externalContactId = provider !== "whatsapp" ? identity.externalId : null;

    await conn.execute(
      `INSERT INTO contacts (
         id, tenant_id, user_id, phone_e164, name,
         source, custom_fields, is_unread, channel,
         instagram_id, whatsapp_number, external_id,
         external_contact_id,
         last_interaction_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = COALESCE(VALUES(name), name),
         custom_fields = VALUES(custom_fields),
         is_unread = IF(VALUES(is_unread) = 1, 1, is_unread),
         channel = VALUES(channel),
         instagram_id = COALESCE(VALUES(instagram_id), instagram_id),
         whatsapp_number = COALESCE(VALUES(whatsapp_number), whatsapp_number),
         external_id = COALESCE(VALUES(external_id), external_id),
         external_contact_id = COALESCE(VALUES(external_contact_id), external_contact_id),
         last_interaction_at = VALUES(last_interaction_at),
         updated_at = NOW()`,
      [
        contactId,
        tenantId,
        userId,
        phoneE164,
        name,
        source,
        JSON.stringify(customFields),
        markUnread ? 1 : 0,
        channel,
        instagramId,
        whatsappNumber,
        identity.externalId,
        externalContactId,
      ],
    );

    // Always fetch the resolved contact id from the unique key.
    const [contactRows] = await conn.execute(
      phoneE164
        ? `SELECT id, phone_e164 FROM contacts
           WHERE user_id = ? AND phone_e164 = ?
           LIMIT 1`
        : `SELECT id, phone_e164 FROM contacts
           WHERE id = ?
           LIMIT 1`,
      phoneE164 ? [userId, phoneE164] : [contactId],
    );

    const resolvedContact = (contactRows as Array<{ id: string; phone_e164: string }>)?.[0];
    if (!resolvedContact?.id) {
      throw new Error(`Failed to resolve contact for ${phoneE164 ?? identity.externalId}`);
    }

    // If the resolved contact has changed its phone, keep the original identity contact id.
    const resolvedContactId = resolvedContact.id;

    // If we did not find the contact by identity, it is new if the generated id matches.
    const isNewContact = !existingContactByIdentity && resolvedContactId === contactId;

    // 2. Upsert contact identity (external id per provider)
    const enrichedMetadata = (enrichedIdentity.metadata ?? {}) as Record<string, unknown>;
    const identityMetadata: Record<string, unknown> = {
      ...enrichedMetadata,
      source: `${provider}_inbound`,
      raw_name: enrichedIdentity.name,
      ...(provider === "instagram" && enrichedIdentity.avatarUrl
        ? {
            avatar_source: "instagram_user_profile_api",
            avatar_fetched_at: new Date().toISOString(),
          }
        : {}),
    };

    await conn.execute(
      `INSERT INTO contact_identities (
         id, tenant_id, user_id, contact_id, provider,
         external_id, phone_e164, username, avatar_url,
         metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         contact_id = VALUES(contact_id),
         phone_e164 = VALUES(phone_e164),
         username = VALUES(username),
         avatar_url = VALUES(avatar_url),
         metadata = VALUES(metadata),
         updated_at = NOW()`,
      [
        randomUUID(),
        tenantId,
        userId,
        resolvedContactId,
        provider,
        enrichedIdentity.externalId,
        enrichedIdentity.phoneE164 ?? phoneE164,
        (typeof instagramUsername === "string" ? instagramUsername : enrichedIdentity.name) ?? null,
        enrichedIdentity.avatarUrl ?? null,
        JSON.stringify(identityMetadata),
      ],
    );

    return { contactId: resolvedContactId, isNew: isNewContact };
  });
}

export async function getContactByIdentity(
  userId: string,
  provider: MessagingProvider,
  externalId: string,
): Promise<{ id: string } | null> {
  const [rows] = await db.query(
    `SELECT c.id
     FROM contacts c
     JOIN contact_identities ci ON ci.contact_id = c.id
     WHERE c.user_id = ? AND ci.provider = ? AND ci.external_id = ?
     LIMIT 1`,
    [userId, provider, externalId],
  ) as Array<{ id: string }>[];

  return rows?.[0] ?? null;
}
