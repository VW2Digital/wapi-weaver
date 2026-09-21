"use server";

import db from "@/lib/db";

/**
 * LEGACY: Configuração central de segredos Meta em platform_settings.
 *
 * Esta fonte permanece APENAS para compatibilidade com instalações anteriores
 * (single-tenant / Meta App central). Novo código multi-tenant (V3) deve
 * utilizar exclusivamente `meta_app_connections` por `public_id`.
 *
 * Nenhuma variável de ambiente `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
 * `VITE_META_APP_ID` ou `VITE_META_CONFIG_ID` é consultada aqui.
 */

import { createHmac, timingSafeEqual } from "crypto";

interface PlatformSecretsRow {
  meta_app_id: string | null;
  meta_app_secret: string | null;
  webhook_verify_token: string | null;
}

async function getPlatformSecrets(): Promise<PlatformSecretsRow | null> {
  const rows = (await db.query(
    "SELECT meta_app_id, meta_app_secret, webhook_verify_token FROM platform_settings WHERE id = 1 LIMIT 1",
  )) as PlatformSecretsRow[];
  return rows?.[0] ?? null;
}

/**
 * LEGACY: metadados do App Meta configurado na plataforma (sem expor segredos).
 */
export async function getMetaAppConfig(): Promise<{
  appId: string | null;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
}> {
  const platform = await getPlatformSecrets();
  const appId = platform?.meta_app_id || null;
  const hasAppSecret = Boolean(String(platform?.meta_app_secret ?? "").trim());
  const hasVerifyToken = Boolean(String(platform?.webhook_verify_token ?? "").trim());

  return { appId, hasAppSecret, hasVerifyToken };
}

/**
 * LEGACY: resolve o App Secret da plataforma (sem fallback de ambiente).
 */
export async function resolveMetaAppSecret(): Promise<string | null> {
  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) return platformSecret;
  return null;
}

export interface WebhookSecretResolution {
  source: "platform_settings" | "channel_account";
  secret: string;
  appId: string | null;
  tenantId?: string | null;
}

/**
 * LEGACY: retorna a chave secreta (App Secret) para validação do Webhook.
 *
 * Busca na tabela específica do canal/integração:
 *  - WhatsApp: `profiles.whatsapp_app_secret`
 *  - Instagram: `instagram_accounts.app_secret`
 *
 * Não utiliza `process.env.META_APP_SECRET`.
 */
export async function getMetaWebhookSecret(
  provider: "whatsapp" | "instagram" | "messenger" = "whatsapp",
  resourceId?: string,
): Promise<WebhookSecretResolution> {
  const platform = await getPlatformSecrets();
  const dbSecret = String(platform?.meta_app_secret ?? "").trim();
  const platformAppId = platform?.meta_app_id || null;

  if (dbSecret && dbSecret.length >= 20) {
    return {
      source: "platform_settings",
      secret: dbSecret,
      appId: platformAppId,
    };
  }

  if (provider === "whatsapp") {
    let query = "SELECT whatsapp_app_secret, whatsapp_app_id FROM profiles WHERE whatsapp_app_secret IS NOT NULL AND whatsapp_app_secret <> ''";
    const params: any[] = [];
    if (!resourceId) {
      throw new Error("META_APP_SECRET_NOT_CONFIGURED");
    }
    query += " AND whatsapp_phone_number_id = ? LIMIT 1";
    params.push(resourceId);

    const rows = (await db.query(query, params)) as Array<{
      whatsapp_app_secret: string | null;
      whatsapp_app_id: string | null;
    }>;
    const profSecret = String(rows[0]?.whatsapp_app_secret ?? "").trim();
    if (profSecret) {
      return {
        source: "channel_account",
        secret: profSecret,
        appId: rows[0]?.whatsapp_app_id || platformAppId,
      };
    }
  } else if (provider === "instagram") {
    let query = "SELECT app_secret FROM instagram_accounts WHERE app_secret IS NOT NULL AND app_secret <> ''";
    const params: any[] = [];
    if (!resourceId) {
      throw new Error("META_APP_SECRET_NOT_CONFIGURED");
    }
    query += " AND (page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?) LIMIT 1";
    params.push(resourceId, resourceId, resourceId);

    const rows = (await db.query(query, params)) as Array<{ app_secret: string | null }>;
    const igSecret = String(rows[0]?.app_secret ?? "").trim();
    if (igSecret) {
      return {
        source: "channel_account",
        secret: igSecret,
        appId: platformAppId,
      };
    }
  }

  throw new Error("META_APP_SECRET_NOT_CONFIGURED");
}

async function listMessengerSignatureSecrets(resourceId: string): Promise<WebhookSecretResolution[]> {
  const found: WebhookSecretResolution[] = [];
  const seen = new Set<string>();
  const push = (candidate: WebhookSecretResolution) => {
    if (candidate.secret.length < 20 || seen.has(candidate.secret)) return;
    seen.add(candidate.secret);
    found.push(candidate);
  };

  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) {
    push({
      source: "platform_settings",
      secret: platformSecret,
      appId: platform?.meta_app_id || null,
    });
  }

  const pages = (await db.query(
    `SELECT user_id FROM facebook_pages WHERE page_id = ? LIMIT 2`,
    [resourceId],
  )) as Array<{ user_id: string | null }>;
  const tenantIds = [...new Set(pages.map((page) => page.user_id).filter((id): id is string => Boolean(id)))];
  if (tenantIds.length === 0) return found;

  const placeholders = tenantIds.map(() => "?").join(", ");
  const connections = (await db.query(
    `SELECT tenant_id, app_id, app_secret_encrypted
     FROM meta_app_connections
     WHERE tenant_id IN (${placeholders})`,
    tenantIds,
  )) as Array<{ tenant_id: string | null; app_id: string | null; app_secret_encrypted: string | null }>;

  await pushConnectionSecrets(connections, push);
  return found;
}

async function listInstagramSignatureSecrets(resourceId: string): Promise<WebhookSecretResolution[]> {
  const found: WebhookSecretResolution[] = [];
  const seen = new Set<string>();
  const push = (candidate: WebhookSecretResolution) => {
    if (candidate.secret.length < 20 || seen.has(candidate.secret)) return;
    seen.add(candidate.secret);
    found.push(candidate);
  };

  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) {
    push({
      source: "platform_settings",
      secret: platformSecret,
      appId: platform?.meta_app_id || null,
    });
  }

  const accounts = (await db.query(
    `SELECT tenant_id, user_id, app_secret
     FROM instagram_accounts
     WHERE page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?`,
    [resourceId, resourceId, resourceId],
  )) as Array<{ tenant_id: string | null; user_id: string | null; app_secret: string | null }>;

  for (const account of accounts) {
    const igSecret = String(account.app_secret ?? "").trim();
    if (igSecret) {
      push({
        source: "channel_account",
        secret: igSecret,
        appId: platform?.meta_app_id || null,
      });
    }
  }

  const tenantIds = [
    ...new Set(accounts.map((account) => account.tenant_id || account.user_id).filter((id): id is string => Boolean(id))),
  ];
  if (tenantIds.length === 0) {
    const priorTenants = (await db.query(
      `SELECT DISTINCT tenant_id
       FROM webhook_delivery_logs
       WHERE provider = 'instagram'
         AND channel_resource_id = ?
         AND tenant_id IS NOT NULL
         AND outcome = 'queued'
       LIMIT 5`,
      [resourceId],
    )) as Array<{ tenant_id: string | null }>;
    for (const row of priorTenants) {
      if (row.tenant_id) tenantIds.push(row.tenant_id);
    }
  }
  if (tenantIds.length === 0) return found;

  const placeholders = tenantIds.map(() => "?").join(", ");
  const connections = (await db.query(
    `SELECT tenant_id, app_id, app_secret_encrypted
     FROM meta_app_connections
     WHERE tenant_id IN (${placeholders})`,
    tenantIds,
  )) as Array<{ tenant_id: string | null; app_id: string | null; app_secret_encrypted: string | null }>;

  await pushConnectionSecrets(connections, push);

  return found;
}

async function pushConnectionSecrets(
  connections: Array<{ tenant_id: string | null; app_id: string | null; app_secret_encrypted: string | null }>,
  push: (candidate: WebhookSecretResolution) => void,
) {
  const { decryptMetaCredential } = await import("@/lib/encryption");
  for (const connection of connections) {
    if (!connection.app_secret_encrypted) continue;
    try {
      const secret = decryptMetaCredential(connection.app_secret_encrypted).trim();
      if (secret) {
        push({
          source: "channel_account",
          secret,
          appId: connection.app_id,
          tenantId: connection.tenant_id,
        });
      }
    } catch {
      // Credencial ilegível não entra na verificação.
    }
  }
}

function signatureMatches(rawBody: string, signatureHeader: string, secret: string) {
  const expected = "sha256=" + createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8")).digest("hex");
  return (
    expected.length === signatureHeader.length &&
    timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signatureHeader, "utf8"))
  );
}

export interface SignatureValidationResult {
  valid: boolean;
  matchedSource: "platform_settings" | "channel_account" | null;
  appId?: string | null;
  tenantId?: string | null;
  reason?: string;
}

/**
 * LEGACY: validação criptográfica de X-Hub-Signature-256.
 */
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  provider: "whatsapp" | "instagram" | "messenger" = "whatsapp",
  resourceId?: string,
): Promise<SignatureValidationResult> {
  if ((provider === "instagram" || provider === "messenger") && resourceId) {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return { valid: false, matchedSource: null, reason: "missing_or_malformed_header" };
    }
    const candidates =
      provider === "instagram"
        ? await listInstagramSignatureSecrets(resourceId)
        : await listMessengerSignatureSecrets(resourceId);
    if (candidates.length === 0) {
      console.error(`[META_WEBHOOK_SIGNATURE] provider=${provider} valid=false reason=META_APP_SECRET_NOT_CONFIGURED`);
      return { valid: false, matchedSource: null, reason: "META_APP_SECRET_NOT_CONFIGURED" };
    }
    for (const candidate of candidates) {
      if (signatureMatches(rawBody, signatureHeader, candidate.secret)) {
        console.log(
          `[META_WEBHOOK_SIGNATURE] provider=${provider} appId=${candidate.appId} secretSource=${candidate.source} valid=true`,
        );
        return {
          valid: true,
          matchedSource: candidate.source,
          appId: candidate.appId,
          tenantId: candidate.tenantId ?? null,
        };
      }
    }
    console.log(
      `[META_WEBHOOK_SIGNATURE] provider=${provider} candidates=${candidates.length} valid=false reason=invalid_signature`,
    );
    return { valid: false, matchedSource: null, reason: "invalid_signature" };
  }

  let secretConfig: WebhookSecretResolution;
  try {
    secretConfig = await getMetaWebhookSecret(provider, resourceId);
  } catch (err: any) {
    console.error(`[META_WEBHOOK_SIGNATURE] provider=${provider} valid=false reason=META_APP_SECRET_NOT_CONFIGURED`);
    return { valid: false, matchedSource: null, reason: "META_APP_SECRET_NOT_CONFIGURED" };
  }

  const { source, secret, appId } = secretConfig;

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    console.log(
      `[META_WEBHOOK_SIGNATURE] provider=${provider} appId=${appId} secretSource=${source} secretLength=${secret.length} signaturePresent=${Boolean(
        signatureHeader,
      )} rawBodyLength=${Buffer.byteLength(rawBody, "utf8")} valid=false reason=missing_or_malformed_header`,
    );
    return { valid: false, matchedSource: null, appId, reason: "missing_or_malformed_header" };
  }

  const expected = "sha256=" + createHmac("sha256", secret).update(Buffer.from(rawBody, "utf8")).digest("hex");

  const valid =
    typeof signatureHeader === "string" &&
    expected.length === signatureHeader.length &&
    timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signatureHeader, "utf8"));

  console.log(
    `[META_WEBHOOK_SIGNATURE] provider=${provider} appId=${appId} secretSource=${source} secretLength=${secret.length} signaturePresent=true rawBodyLength=${Buffer.byteLength(
      rawBody,
      "utf8",
    )} valid=${valid}`,
  );

  return {
    valid,
    matchedSource: valid ? source : null,
    appId,
    reason: valid ? undefined : "invalid_signature",
  };
}

/**
 * LEGACY: validação do token de verificação GET.
 *
 * Não utiliza `process.env.META_WEBHOOK_VERIFY_TOKEN`.
 */
export async function validateWebhookVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;

  const platform = await getPlatformSecrets();
  const platformToken = String(platform?.webhook_verify_token ?? "").trim();
  if (platformToken && token === platformToken) return true;

  const profileRows = (await db.query(
    "SELECT id FROM profiles WHERE whatsapp_verify_token = ? LIMIT 1",
    [token],
  )) as Array<{ id: string }>;
  if (profileRows?.[0]?.id) {
    console.warn(
      "[platform-config] verify token resolvido via profiles (legado). Configure platform_settings.webhook_verify_token.",
    );
    return true;
  }

  return false;
}
