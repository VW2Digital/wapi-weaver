"use server";

import { randomBytes, createHash } from "crypto";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { getWidgetByPublicId } from "./widget.repository";
import type { WebchatWidget } from "@/lib/webchat.functions";

const SESSION_TTL_DAYS = 30;

export interface WebchatSession {
  id: string;
  tenantId: string;
  widgetId: string;
  channelConnectionId: string;
  visitorId: string;
  conversationId: string | null;
  contactIdentityId: string | null;
  status: string;
  expiresAt: Date;
}

export interface PrechatInput {
  name?: string;
  email?: string;
  phone?: string;
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function checkOrigin(widget: WebchatWidget, origin: string | null): boolean {
  if (!origin) return true; // same-origin requests may omit Origin
  if (!widget.allowedOrigins || widget.allowedOrigins.length === 0) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return widget.allowedOrigins.some((o) => normalizeOrigin(o) === normalized);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createWebchatSession(
  publicId: string,
  inputVisitorId: string | undefined,
  origin: string | null,
): Promise<{ sessionToken: string; session: WebchatSession }> {
  const widget = await getWidgetByPublicId(publicId);
  if (!widget || !widget.enabled) {
    const err = new Error("Widget not found or disabled");
    (err as any).statusCode = 404;
    throw err;
  }

  if (!checkOrigin(widget, origin)) {
    const err = new Error("Origin not allowed");
    (err as any).statusCode = 403;
    throw err;
  }

  const visitorId = inputVisitorId && inputVisitorId.trim() ? inputVisitorId.trim() : randomUUID();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  // Look for previous contact and conversation for this visitor
  const identityRows = (await db.query(
    `SELECT id, contact_id FROM contact_identities
     WHERE tenant_id = ? AND provider = 'webchat' AND external_id = ?
     LIMIT 1`,
    [widget.tenantId, visitorId],
  )) as any[];
  const identity = identityRows?.[0];

  let conversationId: string | null = null;
  if (identity?.contact_id) {
    const conversationRows = (await db.query(
      `SELECT id FROM chat_sessions
       WHERE tenant_id = ? AND user_id = ? AND contact_id = ?
       ORDER BY started_at DESC
       LIMIT 1`,
      [widget.tenantId, widget.tenantId, identity.contact_id],
    )) as any[];
    conversationId = conversationRows?.[0]?.id ?? null;
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Delete any existing session for this (widget, visitor) to keep one active session
  await db.query(
    `DELETE FROM webchat_sessions
     WHERE widget_id = ? AND visitor_id = ?`,
    [widget.id, visitorId],
  );

  await db.query(
    `INSERT INTO webchat_sessions (
      id, tenant_id, widget_id, channel_connection_id, visitor_id,
      contact_identity_id, conversation_id, token_hash, status, expires_at, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW(), NOW())`,
    [
      sessionId,
      widget.tenantId,
      widget.id,
      widget.channelConnectionId,
      visitorId,
      identity?.id ?? null,
      conversationId,
      tokenHash,
      expiresAt,
    ],
  );

  const session: WebchatSession = {
    id: sessionId,
    tenantId: widget.tenantId,
    widgetId: widget.id,
    channelConnectionId: widget.channelConnectionId,
    visitorId,
    conversationId,
    contactIdentityId: identity?.id ?? null,
    status: "active",
    expiresAt,
  };

  return { sessionToken: rawToken, session };
}

export async function getWebchatSessionByToken(
  publicId: string,
  rawToken: string,
  origin: string | null,
): Promise<WebchatSession | null> {
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);

  const rows = (await db.query(
    `SELECT s.id, s.tenant_id, s.widget_id, s.channel_connection_id, s.visitor_id,
            s.conversation_id, s.contact_identity_id, s.status, s.expires_at,
            w.public_id, w.enabled, w.allowed_origins
     FROM webchat_sessions s
     JOIN webchat_widgets w ON w.id = s.widget_id
     WHERE w.public_id = ? AND s.token_hash = ?
     LIMIT 1`,
    [publicId, tokenHash],
  )) as any[];
  const row = rows?.[0];
  if (!row) return null;
  if (!row.enabled) return null;
  if (row.status !== "active") return null;
  if (new Date(row.expires_at) < new Date()) return null;

  const allowedOrigins = row.allowed_origins ? JSON.parse(row.allowed_origins) : [];
  if (origin && allowedOrigins.length > 0) {
    const normalized = normalizeOrigin(origin);
    if (!allowedOrigins.some((o: string) => normalizeOrigin(o) === normalized)) {
      return null;
    }
  }

  // Refresh last_seen_at
  await db.query(
    `UPDATE webchat_sessions SET last_seen_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [row.id],
  );

  return {
    id: row.id,
    tenantId: row.tenant_id,
    widgetId: row.widget_id,
    channelConnectionId: row.channel_connection_id,
    visitorId: row.visitor_id,
    conversationId: row.conversation_id ?? null,
    contactIdentityId: row.contact_identity_id ?? null,
    status: row.status,
    expiresAt: new Date(row.expires_at),
  };
}
