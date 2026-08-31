"use server";

import db from "@/lib/db";
import type { WebchatWidget } from "../webchat.functions";

export async function getWidgetByPublicId(publicId: string): Promise<WebchatWidget | null> {
  const rows = await db.query(
    `SELECT
      w.id,
      w.tenant_id,
      w.channel_connection_id,
      w.public_id,
      w.name,
      w.enabled,
      w.title,
      w.welcome_message,
      w.placeholder,
      w.accent_color,
      w.position,
      w.allowed_origins,
      w.prechat_enabled,
      w.created_at,
      w.updated_at
    FROM webchat_widgets w
    WHERE w.public_id = ?
    LIMIT 1`,
    [publicId],
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channelConnectionId: row.channel_connection_id,
    publicId: row.public_id,
    name: row.name ?? null,
    enabled: Boolean(row.enabled),
    title: row.title ?? "Chat",
    welcomeMessage: row.welcome_message ?? null,
    placeholder: row.placeholder ?? "Digite uma mensagem...",
    accentColor: row.accent_color ?? "#0ea5e9",
    position: row.position ?? "bottom-right",
    allowedOrigins: row.allowed_origins ? JSON.parse(row.allowed_origins) : [],
    prechatEnabled: Boolean(row.prechat_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
