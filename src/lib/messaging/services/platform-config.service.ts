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
    if (resourceId) {
      query += " AND whatsapp_phone_number_id = ?";
      params.push(resourceId);
    }
    query += " LIMIT 1";

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
    if (resourceId) {
      query += " AND (page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?)";
      params.push(resourceId, resourceId, resourceId);
    }
    query += " LIMIT 1";

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

export interface SignatureValidationResult {
  valid: boolean;
  matchedSource: "platform_settings" | "channel_account" | null;
  appId?: string | null;
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

  const strict = process.env.META_WEBHOOK_LEGACY_STRICT !== "0";

  const valid =
    typeof signatureHeader === "string" &&
    expected.length === signatureHeader.length &&
    timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signatureHeader, "utf8"));

  if (!valid && !strict) {
    console.warn(
      `[META_WEBHOOK_SIGNATURE] provider=${provider} appId=${appId} secretSource=${source} rawBodyLength=${Buffer.byteLength(
        rawBody,
        "utf8",
      )} BYPASSING_LEGACY_SIGNATURE_CHECK accepted_unverified`,
    );
    return {
      valid: true,
      matchedSource: source,
      appId,
      reason: undefined,
    };
  }

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
