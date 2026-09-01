"use server";

import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "@/lib/db";
import { getWebchatAppUrl, getWebchatEmbedCode } from "./webchat/embed";

export interface WebchatWidget {
  id: string;
  tenantId: string;
  channelConnectionId: string;
  publicId: string;
  name: string | null;
  enabled: boolean;
  title: string;
  welcomeMessage: string | null;
  placeholder: string;
  accentColor: string;
  position: string;
  allowedOrigins: string[];
  prechatEnabled: boolean;
  embedCode?: string;
  createdAt: string;
  updatedAt: string;
}

export const getWebchatWidgets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
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
      WHERE w.tenant_id = ?
      ORDER BY w.created_at DESC`,
      [context.tenantId],
    );
    const appUrl = getWebchatAppUrl();
    return (rows as any[]).map((row) => ({
      ...mapWidgetRow(row),
      embedCode: getWebchatEmbedCode({ appUrl, publicId: row.public_id }),
    }));
  });

export const createWebchatWidget = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const channelConnectionId = randomUUID();
    const widgetId = randomUUID();
    const publicId = randomUUID();

    await db.transaction(async (conn) => {
      await conn.query(
        `INSERT INTO channel_connections (
          id, tenant_id, provider, status, external_account_id, display_name,
          connected_at, created_at, updated_at
        ) VALUES (?, ?, 'webchat', 'active', ?, 'WebChat', NOW(), NOW(), NOW())`,
        [channelConnectionId, context.tenantId, publicId],
      );

      await conn.query(
        `INSERT INTO webchat_widgets (
          id, tenant_id, channel_connection_id, public_id,
          title, welcome_message, placeholder, accent_color,
          enabled, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'Chat', 'Olá! Como podemos ajudar?', 'Digite uma mensagem...', '#0ea5e9', 1, 'bottom-right', NOW(), NOW())`,
        [widgetId, context.tenantId, channelConnectionId, publicId],
      );
    });

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
      WHERE w.id = ? AND w.tenant_id = ?
      LIMIT 1`,
      [widgetId, context.tenantId],
    );
    const appUrl = getWebchatAppUrl();
    return {
      ...mapWidgetRow((rows as any[])[0]),
      embedCode: getWebchatEmbedCode({ appUrl, publicId: (rows as any[])[0].public_id }),
    };
  });

export const updateWebchatWidget = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: {
    id: string;
    title?: string;
    welcomeMessage?: string;
    placeholder?: string;
    accentColor?: string;
    enabled?: boolean;
    position?: string;
    allowedOrigins?: string[];
  }) => input)
  .handler(async ({ context, data }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.welcomeMessage !== undefined) { fields.push("welcome_message = ?"); values.push(data.welcomeMessage); }
    if (data.placeholder !== undefined) { fields.push("placeholder = ?"); values.push(data.placeholder); }
    if (data.accentColor !== undefined) { fields.push("accent_color = ?"); values.push(data.accentColor); }
    if (data.enabled !== undefined) { fields.push("enabled = ?"); values.push(data.enabled ? 1 : 0); }
    if (data.position !== undefined) { fields.push("position = ?"); values.push(data.position); }
    if (data.allowedOrigins !== undefined) { fields.push("allowed_origins = ?"); values.push(JSON.stringify(data.allowedOrigins)); }

    if (fields.length === 0) {
      throw new Error("Nenhum campo para atualizar");
    }

    values.push(data.id, context.tenantId);
    await db.query(
      `UPDATE webchat_widgets SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    return { ok: true };
  });

function mapWidgetRow(row: any): WebchatWidget {
  if (!row) return null as unknown as WebchatWidget;
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
