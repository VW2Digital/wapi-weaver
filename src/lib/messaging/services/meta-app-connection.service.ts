"use server";

import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { encryptMetaCredential, decryptMetaCredential } from "@/lib/encryption";

export interface MetaAppConnectionRecord {
  id: string;
  public_id: string;
  tenant_id: string;
  created_by_user_id: string;
  app_name: string | null;
  app_id: string;
  app_secret_encrypted: string;
  meta_config_id: string | null;
  webhook_verify_token_encrypted: string;
  graph_version: string;
  status: "active" | "pending" | "degraded" | "reauth_required" | "disconnected";
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedMetaAppSecret {
  connectionId: string;
  tenantId: string;
  appId: string;
  appSecret: string;
  metaConfigId: string | null;
  webhookVerifyToken: string;
  graphVersion: string;
  status: string;
}

/**
 * Resolve Meta App connection by its public_id.
 * Decrypts app_secret and webhook_verify_token server-side safely.
 */
export async function getMetaAppConnectionByPublicId(
  publicId: string,
): Promise<ResolvedMetaAppSecret | null> {
  if (!publicId) return null;

  const rows = await query<Array<any>>(
    `SELECT id, public_id, tenant_id, app_id, app_secret_encrypted,
            meta_config_id, webhook_verify_token_encrypted, graph_version, status
     FROM meta_app_connections
     WHERE public_id = ?
     LIMIT 1`,
    [publicId],
  );

  const row = rows?.[0];
  if (!row) return null;

  let decryptedSecret = "";
  let decryptedToken = "";

  try {
    decryptedSecret = decryptMetaCredential(row.app_secret_encrypted);
  } catch (err) {
    console.error(`[MetaAppConnection] Failed to decrypt secret for connection ${row.id}:`, err);
    return null;
  }

  try {
    decryptedToken = decryptMetaCredential(row.webhook_verify_token_encrypted);
  } catch (err) {
    console.error(`[MetaAppConnection] Failed to decrypt verify token for connection ${row.id}:`, err);
    return null;
  }

  return {
    connectionId: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    appSecret: decryptedSecret,
    metaConfigId: row.meta_config_id || null,
    webhookVerifyToken: decryptedToken,
    graphVersion: row.graph_version || "v26.0",
    status: row.status,
  };
}

/**
 * List Meta App connections for a tenant (masked secrets for UI safety).
 */
export async function listMetaAppConnections(tenantId: string) {
  const rows = await query<Array<any>>(
    `SELECT id, public_id, tenant_id, app_name, app_id, meta_config_id, graph_version,
            status, last_verified_at, last_error, created_at, updated_at
     FROM meta_app_connections
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId],
  );

  return (rows || []).map((r) => ({
    id: r.id,
    publicId: r.public_id,
    tenantId: r.tenant_id,
    appName: r.app_name,
    appId: r.app_id,
    metaConfigId: r.meta_config_id,
    graphVersion: r.graph_version,
    status: r.status,
    lastVerifiedAt: r.last_verified_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Save or rotate a Meta App connection for a tenant with encryption-at-rest.
 */
export async function saveMetaAppConnection(options: {
  tenantId: string;
  userId: string;
  appId: string;
  appSecret: string;
  metaConfigId?: string | null;
  appName?: string | null;
  graphVersion?: string;
}) {
  const { tenantId, userId, appId, appSecret, metaConfigId = null, appName = null, graphVersion = "v26.0" } = options;

  if (!appId || !appSecret) {
    throw new Error("App ID e App Secret são obrigatórios.");
  }

  const encryptedSecret = encryptMetaCredential(appSecret.trim());
  const randomVerifyToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const encryptedVerifyToken = encryptMetaCredential(randomVerifyToken);

  const existingRows = await query<Array<{ id: string; public_id: string }>>(
    `SELECT id, public_id FROM meta_app_connections WHERE tenant_id = ? AND app_id = ? LIMIT 1`,
    [tenantId, appId.trim()],
  );

  const existing = existingRows?.[0];

  if (existing?.id) {
    // Update existing connection (rotate secret)
    await query(
      `UPDATE meta_app_connections
       SET app_secret_encrypted = ?,
           meta_config_id = ?,
           app_name = COALESCE(?, app_name),
           graph_version = ?,
           last_error = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [encryptedSecret, metaConfigId || null, appName, graphVersion, existing.id],
    );

    return {
      connectionId: existing.id,
      publicId: existing.public_id,
      isNew: false,
    };
  }

  // Create new connection with status = 'pending'
  const connectionId = randomUUID();
  const publicId = randomUUID();

  await query(
    `INSERT INTO meta_app_connections (
       id, public_id, tenant_id, created_by_user_id, app_name,
       app_id, app_secret_encrypted, meta_config_id, webhook_verify_token_encrypted,
       graph_version, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [
      connectionId,
      publicId,
      tenantId,
      userId,
      appName,
      appId.trim(),
      encryptedSecret,
      metaConfigId || null,
      encryptedVerifyToken,
      graphVersion,
    ],
  );

  return {
    connectionId,
    publicId,
    isNew: true,
  };
}

/**
 * List channel connections for a tenant.
 */
export async function listChannelConnections(tenantId: string) {
  const rows = await query<Array<any>>(
    `SELECT id, tenant_id, meta_app_connection_id, provider, status,
            external_account_id, display_name, metadata, connected_at,
            disconnected_at, last_health_check_at, created_at, updated_at
     FROM channel_connections
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId],
  );

  return rows || [];
}

/**
 * Connect or update a channel connection with unique asset ownership validation.
 */
export async function saveChannelConnection(options: {
  tenantId: string;
  metaAppConnectionId?: string | null;
  provider: "whatsapp" | "instagram" | "messenger";
  externalAccountId: string;
  displayName?: string | null;
  metadata?: Record<string, any> | null;
  accessToken?: string | null;
}) {
  const { tenantId, metaAppConnectionId = null, provider, externalAccountId, displayName = null, metadata = null, accessToken = null } = options;

  if (!externalAccountId || !provider) {
    throw new Error("Provider e External Account ID são obrigatórios.");
  }

  // 1. Check ownership across ALL tenants (anti-hijacking)
  const existingOwner = await query<Array<{ id: string; tenant_id: string }>>(
    `SELECT id, tenant_id FROM channel_connections
     WHERE provider = ? AND external_account_id = ?
     LIMIT 1`,
    [provider, externalAccountId.trim()],
  );

  if (existingOwner?.[0] && existingOwner[0].tenant_id !== tenantId) {
    throw new Error(`CONFLICT: Este asset (${provider}: ${externalAccountId}) já está vinculado a outro tenant.`);
  }

  const encryptedAccessToken = accessToken ? encryptMetaCredential(accessToken.trim()) : null;

  if (existingOwner?.[0]) {
    // Update existing channel
    await query(
      `UPDATE channel_connections
       SET meta_app_connection_id = ?,
           display_name = COALESCE(?, display_name),
           metadata = COALESCE(?, metadata),
           access_token_encrypted = COALESCE(?, access_token_encrypted),
           updated_at = NOW()
       WHERE id = ?`,
      [
        metaAppConnectionId,
        displayName,
        metadata ? JSON.stringify(metadata) : null,
        encryptedAccessToken,
        existingOwner[0].id,
      ],
    );

    return { id: existingOwner[0].id, isNew: false };
  }

  // Create new channel connection
  const id = randomUUID();
  await query(
    `INSERT INTO channel_connections (
       id, tenant_id, meta_app_connection_id, provider, status,
       external_account_id, display_name, metadata, access_token_encrypted, connected_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      id,
      tenantId,
      metaAppConnectionId,
      provider,
      externalAccountId.trim(),
      displayName,
      metadata ? JSON.stringify(metadata) : null,
      encryptedAccessToken,
    ],
  );

  return { id, isNew: true };
}
