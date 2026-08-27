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
    ...(identity.metadata ?? {}),
    ...(metadata ?? {}),
    avatar_url: identity.avatarUrl ?? undefined,
    provider_external_id: identity.externalId,
  };

  return transaction(async (conn) => {
    // Try atomic insert first. If the contact already exists by unique keys,
    // the ON DUPLICATE KEY UPDATE will update name, custom_fields and last interaction.
    const contactId = randomUUID();
    const [insertResult] = await conn.execute(
      `INSERT INTO contacts (
         id, tenant_id, user_id, phone_e164, name, channel,
         external_contact_id, source, custom_fields, is_unread,
         last_interaction_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
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
        provider,
        identity.externalId,
        source,
        JSON.stringify(customFields),
        markUnread ? 1 : 0,
      ],
    );

    const result = insertResult as unknown as ResultSetHeader;

    // If inserted, the generated id was used. Otherwise we need to fetch the existing id.
    if (result.affectedRows === 1) {
      return { contactId, isNew: true };
    }

    // Find the existing contact by the unique key (user_id, channel, external_contact_id)
    const [rows] = await conn.execute(
      `SELECT id FROM contacts
       WHERE user_id = ? AND channel = ? AND external_contact_id = ?
       LIMIT 1`,
      [userId, provider, identity.externalId],
    );

    const existing = (rows as Array<{ id: string }>)?.[0];
    if (!existing?.id) {
      // Fallback to phone_e164 unique key
      const [phoneRows] = await conn.execute(
        `SELECT id FROM contacts
         WHERE user_id = ? AND phone_e164 = ?
         LIMIT 1`,
        [userId, phoneE164],
      );
      const phoneExisting = (phoneRows as Array<{ id: string }>)?.[0];
      if (!phoneExisting?.id) {
        throw new Error(`Failed to resolve contact after upsert for ${provider}:${identity.externalId}`);
      }
      return { contactId: phoneExisting.id, isNew: false };
    }

    return { contactId: existing.id, isNew: false };
  });
}

export async function getContactByIdentity(
  userId: string,
  provider: MessagingProvider,
  externalId: string,
): Promise<{ id: string } | null> {
  const [rows] = await db.query(
    `SELECT id FROM contacts
     WHERE user_id = ? AND channel = ? AND external_contact_id = ?
     LIMIT 1`,
    [userId, provider, externalId],
  ) as Array<{ id: string }>[];

  return rows?.[0] ?? null;
}
