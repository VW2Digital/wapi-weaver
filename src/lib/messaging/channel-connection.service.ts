"use server";

import db from "@/lib/db";
import { decryptMetaCredential } from "@/lib/encryption";

export interface ChannelConnection {
  id: string;
  tenantId: string;
  metaAppConnectionId: string | null;
  provider: "whatsapp" | "instagram" | "messenger";
  status: "active" | "pending" | "degraded" | "reauth_required" | "disconnected";
  externalAccountId: string | null;
  displayName: string | null;
  metadata: unknown;
  accessTokenEncrypted: string | null;
}

export class ChannelConnectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChannelConnectionError";
  }
}

export async function getChannelConnection(
  channelConnectionId: string,
  tenantId: string,
): Promise<ChannelConnection> {
  const rows = (await db.query(
    `SELECT id, tenant_id, meta_app_connection_id, provider, status,
            external_account_id, display_name, metadata, access_token_encrypted
     FROM channel_connections
     WHERE id = ? AND tenant_id = ?
     LIMIT 1`,
    [channelConnectionId, tenantId],
  )) as any[];

  const row = rows[0];
  if (!row) {
    throw new ChannelConnectionError("CHANNEL_NOT_FOUND", "Channel connection not found or access denied.");
  }

  return mapChannelConnection(row);
}

export async function getChannelConnectionByExternalAccount(
  tenantId: string,
  provider: string,
  externalAccountId: string,
): Promise<ChannelConnection | null> {
  const rows = (await db.query(
    `SELECT id, tenant_id, meta_app_connection_id, provider, status,
            external_account_id, display_name, metadata, access_token_encrypted
     FROM channel_connections
     WHERE tenant_id = ? AND provider = ? AND external_account_id = ?
     LIMIT 1`,
    [tenantId, provider, externalAccountId],
  )) as any[];

  return rows[0] ? mapChannelConnection(rows[0]) : null;
}

export async function listChannelConnectionsForTenant(
  tenantId: string,
  provider?: string,
): Promise<ChannelConnection[]> {
  const base = `SELECT id, tenant_id, meta_app_connection_id, provider, status,
                external_account_id, display_name, metadata, access_token_encrypted
                FROM channel_connections
                WHERE tenant_id = ?`;
  const filter = provider ? ` AND provider = ?` : "";
  const rows = (await db.query(
    `${base}${filter} ORDER BY created_at`,
    provider ? [tenantId, provider] : [tenantId],
  )) as any[];

  return rows.map(mapChannelConnection);
}

const ENCRYPTED_CREDENTIAL_PATTERN = /^[0-9a-f]{24,32}:[0-9a-f]+:[0-9a-f]{32}$/i;

/**
 * Resolves the usable (plaintext) access token for a channel connection.
 *
 * V3 channels store an AES-256-GCM credential in `access_token_encrypted`.
 * Legacy resolution paths put the plaintext token in the same field, so the
 * value is only decrypted when it matches the `iv:ciphertext:authTag` shape.
 */
export function resolveChannelAccessToken(channel: ChannelConnection): string {
  const raw = channel.accessTokenEncrypted?.trim() || "";
  if (!raw) {
    throw new ChannelConnectionError(
      "CHANNEL_TOKEN_MISSING",
      `Channel ${channel.id} has no access token configured.`,
    );
  }

  if (!ENCRYPTED_CREDENTIAL_PATTERN.test(raw)) return raw;

  try {
    const decrypted = decryptMetaCredential(raw);
    if (!decrypted) {
      throw new ChannelConnectionError(
        "CHANNEL_TOKEN_MISSING",
        `Channel ${channel.id} decrypted to an empty access token.`,
      );
    }
    return decrypted;
  } catch (error) {
    if (error instanceof ChannelConnectionError) throw error;
    throw new ChannelConnectionError(
      "CHANNEL_TOKEN_DECRYPT_FAILED",
      `Channel ${channel.id} access token could not be decrypted.`,
    );
  }
}

export async function requireActiveChannel(channel: ChannelConnection): Promise<void> {
  if (channel.status !== "active") {
    throw new ChannelConnectionError(
      `CHANNEL_${channel.status.toUpperCase()}`,
      `Channel ${channel.id} is not active (status: ${channel.status}).`,
    );
  }
}

function mapChannelConnection(row: any): ChannelConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    metaAppConnectionId: row.meta_app_connection_id,
    provider: row.provider,
    status: row.status,
    externalAccountId: row.external_account_id,
    displayName: row.display_name,
    metadata: row.metadata,
    accessTokenEncrypted: row.access_token_encrypted,
  };
}
