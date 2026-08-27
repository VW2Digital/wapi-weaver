"use server";

import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import db, { transaction } from "@/lib/db";
import type { CanonicalIdentity, MessagingProvider } from "../types";

export interface EnsureContactOptions {
  tenantId: string;
  userId: string;
  provider: MessagingProvider;
  identity: CanonicalIdentity;
  /** Display phone for WhatsApp; placeholder for Instagram/Messenger. */
  phoneE164: string;
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
  return `Contato (${identity.externalId})`;
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

  const name = buildContactName(identity, provider);
  const customFields = {
    ...(metadata ?? {}),
    avatar_url: identity.avatarUrl ?? undefined,
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
    const channel = provider === "whatsapp" ? "whatsapp" : provider === "instagram" ? "instagram" : "messenger";
    const instagramId = provider === "instagram" ? identity.externalId : null;
    const whatsappNumber = provider === "whatsapp" ? (identity.phoneE164 || phoneE164) : null;

    await conn.execute(
      `INSERT INTO contacts (
         id, tenant_id, user_id, phone_e164, name,
         source, custom_fields, is_unread, channel,
         instagram_id, whatsapp_number, external_id,
         last_interaction_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = COALESCE(VALUES(name), name),
         custom_fields = VALUES(custom_fields),
         is_unread = IF(VALUES(is_unread) = 1, 1, is_unread),
         channel = VALUES(channel),
         instagram_id = COALESCE(VALUES(instagram_id), instagram_id),
         whatsapp_number = COALESCE(VALUES(whatsapp_number), whatsapp_number),
         external_id = COALESCE(VALUES(external_id), external_id),
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
      ],
    );

    // Always fetch the resolved contact id from the unique key.
    const [contactRows] = await conn.execute(
      `SELECT id, phone_e164 FROM contacts
       WHERE user_id = ? AND phone_e164 = ?
       LIMIT 1`,
      [userId, phoneE164],
    );

    const resolvedContact = (contactRows as Array<{ id: string; phone_e164: string }>)?.[0];
    if (!resolvedContact?.id) {
      throw new Error(`Failed to resolve contact for ${phoneE164}`);
    }

    // If the resolved contact has changed its phone, keep the original identity contact id.
    const resolvedContactId = resolvedContact.id;

    // If we did not find the contact by identity, it is new if the generated id matches.
    const isNewContact = !existingContactByIdentity && resolvedContactId === contactId;

    // 2. Upsert contact identity (external id per provider)
    const identityMetadata = {
      ...(identity.metadata ?? {}),
      source: `${provider}_inbound`,
      raw_name: identity.name,
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
        identity.externalId,
        identity.phoneE164 ?? phoneE164,
        identity.name ?? null,
        identity.avatarUrl ?? null,
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
