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

interface PlatformSecretsRow {
  meta_app_secret: string | null;
  webhook_verify_token: string | null;
}

async function getPlatformSecrets(): Promise<PlatformSecretsRow | null> {
  const rows = (await db.query(
    "SELECT meta_app_secret, webhook_verify_token FROM platform_settings WHERE id = 1 LIMIT 1",
  )) as PlatformSecretsRow[];
  return rows?.[0] ?? null;
}

/**
 * Resolve o App Secret usado para validar `X-Hub-Signature-256`.
 * Retorna null quando nenhuma fonte está configurada.
 */
export async function resolveMetaAppSecret(): Promise<string | null> {
  const platform = await getPlatformSecrets();
  const platformSecret = String(platform?.meta_app_secret ?? "").trim();
  if (platformSecret) return platformSecret;

  const envSecret = String(process.env.META_APP_SECRET ?? "").trim();
  if (envSecret) return envSecret;

  return null;
}

export async function validateWebhookVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;

  // 1. Fonte autoritativa: platform_settings.
  const platform = await getPlatformSecrets();
  const platformToken = String(platform?.webhook_verify_token ?? "").trim();
  if (platformToken && token === platformToken) return true;

  // 2. Bootstrap da instalação via ambiente.
  const envToken = String(process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim();
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
