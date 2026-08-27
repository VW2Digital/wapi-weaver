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
    // 1. Upsert contact by (user_id, phone_e164)
    const contactId = randomUUID();
    await conn.execute(
      `INSERT INTO contacts (
         id, tenant_id, user_id, phone_e164, name,
         source, custom_fields, is_unread,
         last_interaction_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = COALESCE(VALUES(name), name),
         custom_fields = VALUES(custom_fields),
         is_unread = IF(VALUES(is_unread) = 1, 1, is_unread),
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
      ],
    );

    // Always fetch the resolved contact id from the unique key.
    const [contactRows] = await conn.execute(
      `SELECT id FROM contacts
       WHERE user_id = ? AND phone_e164 = ?
       LIMIT 1`,
      [userId, phoneE164],
    );

    const resolvedContactId = (contactRows as Array<{ id: string }>)?.[0]?.id;
    if (!resolvedContactId) {
      throw new Error(`Failed to resolve contact for ${phoneE164}`);
    }

    // If the contact id we generated matches the resolved one, it was a new insert.
    // If not, the upsert hit the unique key and returned the existing id.
    const isNewContact = resolvedContactId === contactId;

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
