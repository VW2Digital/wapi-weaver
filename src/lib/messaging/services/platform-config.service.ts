"use server";

import db from "@/lib/db";

let cachedWebhookVerifyToken: string | null | undefined = undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 5_000;

async function getPlatformSetting(key: string): Promise<string | null> {
  const [rows] = (await db.query(`SELECT ${key} FROM platform_settings LIMIT 1`)) as Array<Record<string, string | null>>[];
  return rows?.[0]?.[key] ?? null;
}

export async function getWebhookVerifyToken(): Promise<string | null> {
  if (cachedWebhookVerifyToken !== undefined && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedWebhookVerifyToken;
  }
  const fromDb = await getPlatformSetting("webhook_verify_token");
  const fromEnv = process.env.META_WEBHOOK_VERIFY_TOKEN || null;
  cachedWebhookVerifyToken = fromDb || fromEnv;
  cachedAt = Date.now();
  return cachedWebhookVerifyToken;
}
