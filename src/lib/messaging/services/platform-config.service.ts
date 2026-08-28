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

export interface SignatureValidationResult {
  valid: boolean;
  matchedSource: "platform_settings" | "env" | "profile_legacy" | null;
  reason?: string;
}

/**
 * Validação criptográfica rigorosa de X-Hub-Signature-256 usando HMAC SHA-256.
 *
 * Exige:
 * 1. rawBody original HTTP (string ou Buffer original)
 * 2. Header `sha256=...`
 * 3. Segredo autorizado (platform_settings > env > profile legacy fallback)
 */
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  provider: "whatsapp" | "instagram" | "messenger" = "whatsapp",
): Promise<SignatureValidationResult> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    console.log(
      `[signature-validator] provider=${provider} signaturePresent=${Boolean(
        signatureHeader,
      )} rawBodyLength=${rawBody.length} valid=false reason=missing_or_malformed_header`,
    );
    return { valid: false, matchedSource: null, reason: "missing_or_malformed_header" };
  }

  const providedHash = signatureHeader.slice(7);

  // 1. Fonte autoritativa: platform_settings
  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) {
    const expected = createHmac("sha256", platformSecret).update(rawBody).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(providedHash, "hex"))) {
        console.log(
          `[signature-validator] provider=${provider} candidateSource=platform_settings candidateConfigured=true candidateLength=${platformSecret.length} signatureValid=true`,
        );
        return { valid: true, matchedSource: "platform_settings" };
      }
    } catch {}
  }

  // 2. Bootstrap: process.env.META_APP_SECRET
  const envSecret = String(process.env.META_APP_SECRET ?? "").trim();
  if (envSecret && envSecret !== platformSecret) {
    const expected = createHmac("sha256", envSecret).update(rawBody).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(providedHash, "hex"))) {
        console.log(
          `[signature-validator] provider=${provider} candidateSource=env candidateConfigured=true candidateLength=${envSecret.length} signatureValid=true`,
        );
        return { valid: true, matchedSource: "env" };
      }
    } catch {}
  }

  // 3. Fallback legado: perfis com segredos individuais
  const profileRows = (await db.query(
    "SELECT id, whatsapp_app_secret FROM profiles WHERE whatsapp_app_secret IS NOT NULL AND whatsapp_app_secret <> ''",
  )) as Array<{ id: string; whatsapp_app_secret: string }>;

  for (const prof of profileRows) {
    const profSecret = String(prof.whatsapp_app_secret ?? "").trim();
    if (profSecret && profSecret !== platformSecret && profSecret !== envSecret) {
      const expected = createHmac("sha256", profSecret).update(rawBody).digest("hex");
      try {
        if (timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(providedHash, "hex"))) {
          console.warn(
            `[signature-validator] provider=${provider} candidateSource=profile_legacy profileId=${prof.id} signatureValid=true (Configure platform_settings.meta_app_secret)`,
          );
          return { valid: true, matchedSource: "profile_legacy" };
        }
      } catch {}
    }
  }

  console.log(
    `[signature-validator] provider=${provider} signaturePresent=true rawBodyLength=${rawBody.length} platformConfigured=${Boolean(
      platformSecret,
    )} envConfigured=${Boolean(envSecret)} legacyProfilesTested=${
      profileRows.length
    } valid=false reason=no_secret_matched`,
  );

  return { valid: false, matchedSource: null, reason: "invalid_signature" };
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
