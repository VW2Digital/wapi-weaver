"use server";

import db from "@/lib/db";

/**
 * Fonte autoritativa dos segredos da plataforma Meta.
 *
 * O SaaS opera com um único App Meta central, portanto o App Secret e o
 * verify token pertencem à plataforma — não ao tenant. A ordem de resolução é:
 *
 *   1. `platform_settings` (autoritativa, editável pelo admin master na UI)
 *   2. `process.env` (bootstrap da instalação, sincronizado pelo install.sh)
 *
 * `profiles.whatsapp_app_secret` / `profiles.whatsapp_verify_token` permanecem
 * apenas como compatibilidade para instalações antigas que configuraram o
 * segredo por tenant antes da centralização. Não usar em código novo.
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
 * Retorna metadados do App Meta configurado na plataforma (sem expor segredos).
 */
export async function getMetaAppConfig(): Promise<{
  appId: string | null;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
}> {
  const platform = await getPlatformSecrets();
  const appId = platform?.meta_app_id || process.env.VITE_META_APP_ID || process.env.META_APP_ID || null;
  const hasAppSecret = Boolean(
    String(platform?.meta_app_secret ?? "").trim() || String(process.env.META_APP_SECRET ?? "").trim(),
  );
  const hasVerifyToken = Boolean(
    String(platform?.webhook_verify_token ?? "").trim() ||
      String(process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim(),
  );

  return { appId, hasAppSecret, hasVerifyToken };
}

/**
 * Resolve o App Secret usado para validar `X-Hub-Signature-256`.
 * Prioridade:
 *   1. `platform_settings.meta_app_secret` (fonte autoritativa central)
 *   2. `process.env.META_APP_SECRET` (bootstrap da instalação)
 */
export async function resolveMetaAppSecret(): Promise<string | null> {
  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) return platformSecret;

  const envSecret = String(process.env.META_APP_SECRET ?? "").trim();
  if (envSecret) return envSecret;

  return null;
}

export interface WebhookSecretResolution {
  source: "platform_settings" | "environment";
  secret: string;
  appId: string | null;
}

/**
 * Retorna a fonte autoritativa única do Meta App Secret para webhooks.
 * Regra: platform_settings (autoritativa) > process.env (fallback/bootstrap).
 */
export async function getMetaWebhookSecret(): Promise<WebhookSecretResolution> {
  const platform = await getPlatformSecrets();
  const appId = platform?.meta_app_id || process.env.VITE_META_APP_ID || process.env.META_APP_ID || null;

  const dbSecret = String(platform?.meta_app_secret ?? "").trim();
  if (dbSecret) {
    return {
      source: "platform_settings",
      secret: dbSecret,
      appId,
    };
  }

  const envSecret = String(process.env.META_APP_SECRET ?? "").trim();
  if (envSecret) {
    return {
      source: "environment",
      secret: envSecret,
      appId,
    };
  }

  throw new Error("META_APP_SECRET_NOT_CONFIGURED");
}

export interface SignatureValidationResult {
  valid: boolean;
  matchedSource: "platform_settings" | "environment" | null;
  appId?: string | null;
  reason?: string;
}

/**
 * Validação criptográfica rigorosa de X-Hub-Signature-256 usando HMAC SHA-256.
 *
 * Utiliza exclusivamente o secret central do Meta App configurado (platform_settings > env).
 */
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  provider: "whatsapp" | "instagram" | "messenger" = "whatsapp",
): Promise<SignatureValidationResult> {
  let secretConfig: WebhookSecretResolution;
  try {
    secretConfig = await getMetaWebhookSecret();
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

export async function validateWebhookVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;

  // 1. Fonte autoritativa: platform_settings.
  const platform = await getPlatformSecrets();
  const platformToken = String(platform?.webhook_verify_token ?? "").trim();
  if (platformToken && token === platformToken) return true;

  // 2. Bootstrap da instalação via ambiente.
  const envToken = String(
    process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "",
  ).trim();
  if (envToken && token === envToken) return true;

  // 3. Legado: instalações que configuraram o verify token por tenant.
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
