"use server";

import db from "@/lib/db";

export async function validateWebhookVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;

  // 1. Match against env variable (legacy/local fallback)
  const envToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (envToken && token === envToken) return true;

  // 2. Match against global platform setting
  const [platformRows] = (await db.query(
    "SELECT webhook_verify_token FROM platform_settings WHERE webhook_verify_token = ? LIMIT 1",
    [token],
  )) as Array<{ webhook_verify_token: string | null }>[];
  if (platformRows?.[0]?.webhook_verify_token) return true;

  // 3. Match against tenant-specific WhatsApp verify token (same convention as /whatsapp-webhook)
  const [profileRows] = (await db.query(
    "SELECT id FROM profiles WHERE whatsapp_verify_token = ? LIMIT 1",
    [token],
  )) as Array<{ id: string }>[];
  if (profileRows?.[0]?.id) return true;

  return false;
}
