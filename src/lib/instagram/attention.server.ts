import crypto from "crypto";
import db from "@/lib/db";
import {
  LAST_INBOUND_SQL,
  decideInstagramSend,
  getInstagramMessagingWindow,
  isHumanAgentFeatureEnabled,
  isInstagramReviewPreviewEnabled,
  mapInstagramMetaError,
  metaErrorDetails,
  sanitizeAuditDetail,
  type InstagramConversationMode,
  type InstagramSenderKind,
  type InstagramSendDecision,
} from "./messaging-window";

export class InstagramAttentionError extends Error {
  retryable = false;
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InstagramAttentionError";
  }
}

let auditTableReady = false;

export async function ensureInstagramAttentionSchema(): Promise<void> {
  if (auditTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS instagram_attention_events (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      contact_phone VARCHAR(50) NOT NULL,
      ig_account_id VARCHAR(100) NULL,
      user_id VARCHAR(36) NULL,
      action VARCHAR(64) NOT NULL,
      window_state VARCHAR(32) NULL,
      message_id VARCHAR(64) NULL,
      meta_error_code INT NULL,
      meta_error_subcode INT NULL,
      fbtrace_id VARCHAR(128) NULL,
      detail_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ig_attention_tenant (tenant_id, contact_phone, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const alters: Array<[string, string]> = [
    ["human_takeover_at", "DATETIME NULL"],
    ["human_takeover_by", "VARCHAR(36) NULL"],
    ["takeover_restore_ai", "TINYINT(1) NULL"],
  ];
  for (const [col, def] of alters) {
    const rows = (await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = ?`,
      [col],
    )) as Array<{ c: number }>;
    if (!Number(rows?.[0]?.c)) {
      await db.query(`ALTER TABLE bot_conversation_state ADD COLUMN ${col} ${def}`);
    }
  }
  auditTableReady = true;
}

export async function recordInstagramAttention(input: {
  tenantId: string;
  contactPhone: string;
  action: string;
  windowState?: string | null;
  userId?: string | null;
  igAccountId?: string | null;
  messageId?: string | null;
  metaBody?: unknown;
  detail?: unknown;
}): Promise<void> {
  try {
    await ensureInstagramAttentionSchema();
    const meta = input.metaBody ? metaErrorDetails(input.metaBody) : null;
    await db.query(
      `INSERT INTO instagram_attention_events
        (id, tenant_id, contact_phone, ig_account_id, user_id, action, window_state, message_id,
         meta_error_code, meta_error_subcode, fbtrace_id, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.contactPhone,
        input.igAccountId || null,
        input.userId || null,
        input.action,
        input.windowState || null,
        input.messageId || null,
        meta?.code ?? null,
        meta?.subcode ?? null,
        meta?.fbtraceId ?? null,
        input.detail ? JSON.stringify(sanitizeAuditDetail(input.detail)) : null,
      ],
    );
  } catch (error) {
    console.error("[instagram-attention] audit failed", {
      action: input.action,
      tenantId: input.tenantId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function loadMode(tenantId: string, contactPhone: string): Promise<InstagramConversationMode> {
  const rows = (await db.query(
    `SELECT bot_active, manual_pause
     FROM bot_conversation_state
     WHERE tenant_id = ? AND contact_number = ? AND channel = 'instagram'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [tenantId, contactPhone],
  )) as Array<{ bot_active?: number | boolean | null; manual_pause?: number | boolean | null }>;
  const row = rows?.[0];
  if (!row) return "automated";
  const botOff = row.bot_active === 0 || row.bot_active === false;
  const manual = row.manual_pause === 1 || row.manual_pause === true;
  return botOff && manual ? "human" : "automated";
}

async function loadLastInbound(tenantId: string, contactPhone: string): Promise<Date | null> {
  const rows = (await db.query(LAST_INBOUND_SQL, [tenantId, contactPhone])) as Array<{
    created_at?: Date | string | null;
  }>;
  const value = rows?.[0]?.created_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function evaluateInstagramDispatch(input: {
  tenantId: string;
  contactPhone: string;
  senderKind: InstagramSenderKind;
  requestedHumanAgentTag?: boolean;
}): Promise<InstagramSendDecision> {
  const [lastInboundAt, conversationMode] = await Promise.all([
    loadLastInbound(input.tenantId, input.contactPhone),
    loadMode(input.tenantId, input.contactPhone),
  ]);
  return decideInstagramSend({
    lastInboundAt,
    senderKind: input.senderKind,
    conversationMode,
    humanAgentEnabled: isHumanAgentFeatureEnabled(),
    requestedHumanAgentTag: input.requestedHumanAgentTag,
  });
}

export async function assertInstagramHumanSend(tenantId: string, contactPhone: string): Promise<InstagramSendDecision> {
  const decision = await evaluateInstagramDispatch({
    tenantId,
    contactPhone,
    senderKind: "human",
  });
  if (!decision.allowed) {
    await recordInstagramAttention({
      tenantId,
      contactPhone,
      action: decision.auditAction,
      windowState: decision.window.state,
      detail: { code: decision.code },
    });
    throw new InstagramAttentionError(decision.code, decision.userMessage);
  }
  return decision;
}

export async function assertInstagramAutomationSend(
  tenantId: string,
  contactPhone: string,
): Promise<InstagramSendDecision> {
  const decision = await evaluateInstagramDispatch({
    tenantId,
    contactPhone,
    senderKind: "automation",
    requestedHumanAgentTag: false,
  });
  if (!decision.allowed) {
    await recordInstagramAttention({
      tenantId,
      contactPhone,
      action: decision.auditAction,
      windowState: decision.window.state,
      detail: { code: decision.code },
    });
    throw new InstagramAttentionError(decision.code, decision.userMessage);
  }
  return decision;
}

export async function noteInstagramInbound(input: {
  tenantId: string;
  contactPhone: string;
  igAccountId?: string | null;
  messageId?: string | null;
}): Promise<void> {
  const previous = (await db.query(
    `SELECT created_at FROM direct_messages
     WHERE tenant_id = ? AND contact_phone = ? AND channel = 'instagram' AND direction = 'incoming'
     ORDER BY created_at DESC
     LIMIT 1 OFFSET 1`,
    [input.tenantId, input.contactPhone],
  )) as Array<{ created_at?: Date | string | null }>;
  const previousAt = previous?.[0]?.created_at ? new Date(previous[0].created_at) : null;
  const previousWindow = getInstagramMessagingWindow(previousAt);
  if (!previousAt || previousWindow.state !== "standard") {
    await recordInstagramAttention({
      tenantId: input.tenantId,
      contactPhone: input.contactPhone,
      igAccountId: input.igAccountId,
      messageId: input.messageId,
      action: "MESSAGE_WINDOW_REOPENED",
      windowState: "standard",
      detail: { previous: previousWindow.state },
    });
  }
}

export function friendlyInstagramSendError(body: unknown): string {
  return mapInstagramMetaError(body);
}

export async function getInstagramAttentionView(tenantId: string, contactPhone: string) {
  await ensureInstagramAttentionSchema();
  const [lastInboundAt, mode, accountRows, attendantRows] = await Promise.all([
    loadLastInbound(tenantId, contactPhone),
    loadMode(tenantId, contactPhone),
    db.query(
      `SELECT provider_account_id FROM direct_messages
       WHERE tenant_id = ? AND contact_phone = ? AND channel = 'instagram'
         AND provider_account_id IS NOT NULL AND provider_account_id <> ''
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, contactPhone],
    ) as Promise<Array<{ provider_account_id?: string | null }>>,
    db.query(
      `SELECT COALESCE(p.full_name, u.email, 'Atendente') AS attendant_name
       FROM conversation_assignments ca
       LEFT JOIN profiles p ON p.id = ca.agent_id
       LEFT JOIN users u ON u.id = ca.agent_id
       WHERE ca.tenant_id = ? AND ca.contact_phone = ? AND ca.is_active = 1
       ORDER BY ca.assigned_at DESC LIMIT 1`,
      [tenantId, contactPhone],
    ) as Promise<Array<{ attendant_name?: string | null }>>,
  ]);
  const window = getInstagramMessagingWindow(lastInboundAt);
  const humanAgentEnabled = isHumanAgentFeatureEnabled();
  const igAccountId = accountRows?.[0]?.provider_account_id || null;
  let igAccountLabel = igAccountId;
  if (igAccountId) {
    const names = (await db.query(
      `SELECT instagram_username FROM instagram_accounts
       WHERE tenant_id = ? AND (instagram_business_account_id = ? OR ig_user_id = ?)
       LIMIT 1`,
      [tenantId, igAccountId, igAccountId],
    )) as Array<{ instagram_username?: string | null }>;
    if (names?.[0]?.instagram_username) igAccountLabel = names[0].instagram_username;
  }
  const decision = decideInstagramSend({
    lastInboundAt,
    senderKind: "human",
    conversationMode: mode,
    humanAgentEnabled,
  });
  return {
    contactPhone,
    igAccountId,
    igAccountLabel,
    lastInboundAt: window.lastInboundAt,
    window,
    mode,
    attendantName: mode === "human" ? attendantRows?.[0]?.attendant_name || "Atendente" : null,
    humanAgentEnabled,
    reviewPreviewEnabled: isInstagramReviewPreviewEnabled(),
    publicContentEnabled: false,
    composerEnabled: decision.allowed,
    blockMessage: decision.allowed ? null : decision.userMessage,
  };
}

export async function assumeInstagramAttendance(input: {
  tenantId: string;
  actorUserId: string;
  contactPhone: string;
}): Promise<void> {
  await ensureInstagramAttentionSchema();
  const rows = (await db.query(
    `SELECT id, ai_agent_active FROM bot_conversation_state
     WHERE tenant_id = ? AND contact_number = ? AND channel = 'instagram'
     ORDER BY updated_at DESC LIMIT 1`,
    [input.tenantId, input.contactPhone],
  )) as Array<{ id: string; ai_agent_active?: number | boolean | null }>;
  const restoreAi = rows?.[0]?.ai_agent_active === 1 || rows?.[0]?.ai_agent_active === true ? 1 : 0;
  if (rows?.[0]) {
    await db.query(
      `UPDATE bot_conversation_state
       SET bot_active = 0, ai_agent_active = 0, manual_pause = 1, is_paused = 1,
           human_takeover_at = NOW(), human_takeover_by = ?, takeover_restore_ai = ?
       WHERE id = ? AND tenant_id = ?`,
      [input.actorUserId, restoreAi, rows[0].id, input.tenantId],
    );
  } else {
    await db.query(
      `INSERT INTO bot_conversation_state
        (id, tenant_id, user_id, contact_number, instance_id, channel, bot_active, ai_agent_active,
         manual_pause, is_paused, human_takeover_at, human_takeover_by, takeover_restore_ai)
       VALUES (?, ?, ?, ?, 'default', 'instagram', 0, 0, 1, 1, NOW(), ?, 0)`,
      [crypto.randomUUID(), input.tenantId, input.tenantId, input.contactPhone, input.actorUserId],
    );
  }
  const window = getInstagramMessagingWindow(await loadLastInbound(input.tenantId, input.contactPhone));
  await recordInstagramAttention({
    tenantId: input.tenantId,
    contactPhone: input.contactPhone,
    userId: input.actorUserId,
    action: "HUMAN_TAKEOVER",
    windowState: window.state,
  });
}

export async function resumeInstagramAutomation(input: {
  tenantId: string;
  actorUserId: string;
  contactPhone: string;
}): Promise<void> {
  await ensureInstagramAttentionSchema();
  const window = getInstagramMessagingWindow(await loadLastInbound(input.tenantId, input.contactPhone));
  if (window.state !== "standard") {
    throw new InstagramAttentionError(
      window.state === "closed" ? "MESSAGE_WINDOW_CLOSED" : "cancelled_outside_automation_window",
      window.state === "closed"
        ? "Janela de atendimento encerrada. Aguarde uma nova mensagem do cliente para continuar esta conversa."
        : "Fora da janela padrão de 24h. A automação só volta quando o cliente enviar uma nova mensagem.",
    );
  }
  const rows = (await db.query(
    `SELECT id, takeover_restore_ai FROM bot_conversation_state
     WHERE tenant_id = ? AND contact_number = ? AND channel = 'instagram'
     ORDER BY updated_at DESC LIMIT 1`,
    [input.tenantId, input.contactPhone],
  )) as Array<{ id: string; takeover_restore_ai?: number | null }>;
  if (rows?.[0]) {
    await db.query(
      `UPDATE bot_conversation_state
       SET bot_active = 1, manual_pause = 0, is_paused = 0,
           ai_agent_active = COALESCE(takeover_restore_ai, ai_agent_active),
           human_takeover_at = NULL, human_takeover_by = NULL, takeover_restore_ai = NULL
       WHERE id = ? AND tenant_id = ?`,
      [rows[0].id, input.tenantId],
    );
  }
  await recordInstagramAttention({
    tenantId: input.tenantId,
    contactPhone: input.contactPhone,
    userId: input.actorUserId,
    action: "AUTOMATION_RESUMED",
    windowState: "standard",
  });
}
