/**
 * Orquestração Bot → Auto-assign → IA conforme doc set/2026.
 * Mantém current_step_id / last_interaction (nomes legados) e
 * adiciona ai_agent_active, active_agent_id, manual_pause, locked/locked_at.
 */
import crypto from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";

export const BOT_SENTINELS = {
  GO_TO_AI: "-999",
  TRANSFER_HUMAN: "-998",
  END_FLOW: "-997",
  PAUSE_BOT: "-996",
  RESTART: "-1",
} as const;

export type BotEventType =
  | "pause_manual"
  | "reactivate_manual"
  | "pause_human_crm"
  | "reactivate_timeout"
  | "reactivate_auto_recovery"
  | "ignored_manual_pause"
  | "ignored_within_timeout"
  | "go_to_ai"
  | "transfer_human"
  | "end_flow"
  | "pause_bot"
  | "restart";

let columnsEnsured = false;

export async function ensureBotConversationStateColumns(db?: any): Promise<void> {
  if (columnsEnsured) return;
  const database = db || (await import("./db")).default;
  const alters: Array<[string, string]> = [
    ["ai_agent_active", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["active_agent_id", "VARCHAR(36) NULL"],
    ["manual_pause", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["locked", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["locked_at", "DATETIME NULL"],
  ];
  for (const [col, def] of alters) {
    try {
      const rows = (await database.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bot_conversation_state'
           AND COLUMN_NAME = ?`,
        [col],
      )) as Array<{ c: number }>;
      if (!rows?.[0]?.c) {
        await database.query(`ALTER TABLE bot_conversation_state ADD COLUMN ${col} ${def}`);
      }
    } catch (err: any) {
      console.warn(`[bot-orch] Falha ao garantir coluna ${col}:`, err?.message);
    }
  }

  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS bot_event_log (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        instance_id VARCHAR(50) NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        event_type VARCHAR(64) NOT NULL,
        details_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_bot_event_log_tenant_contact (tenant_id, contact_number, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (err: any) {
    console.warn("[bot-orch] Falha ao garantir bot_event_log:", err?.message);
  }

  // Triggers MySQL são best-effort (SUPER/binlog). Equivalente em app:
  // processBotFlow (alinhamento CRM) + setManualPause.
  columnsEnsured = true;
}

/** Migra sentinels legados: -999 (handoff humano) → -998. */
export async function migrateLegacyBotSentinels(db?: any): Promise<void> {
  const database = db || (await import("./db")).default;
  try {
    await database.query(
      `UPDATE bot_steps SET next_step_id = '-998' WHERE next_step_id = '-999'`,
    );
  } catch (err: any) {
    console.warn("[bot-orch] Migração next_step_id -999→-998:", err?.message);
  }
  try {
    // Destinos em buttons_config / listas (texto JSON)
    await database.query(
      `UPDATE bot_steps
       SET buttons_config = REPLACE(REPLACE(buttons_config, '"-999"', '"-998"'), ':-999', ':-998')
       WHERE buttons_config IS NOT NULL
         AND (buttons_config LIKE '%-999%' )`,
    );
  } catch (err: any) {
    console.warn("[bot-orch] Migração buttons_config -999→-998:", err?.message);
  }
}

export function clampPauseTimeoutMinutes(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(Math.max(Math.trunc(n), 1), 1440);
}

export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}

export async function logBotEvent(params: {
  tenantId: string;
  contactNumber: string;
  instanceId?: string | null;
  channel?: string;
  eventType: BotEventType;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { default: db } = await import("./db");
    await ensureBotConversationStateColumns(db);
    await db.query(
      `INSERT INTO bot_event_log (id, tenant_id, contact_number, instance_id, channel, event_type, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        params.tenantId,
        params.contactNumber,
        params.instanceId || null,
        params.channel || "whatsapp",
        params.eventType,
        params.details ? JSON.stringify(params.details) : null,
      ],
    );
  } catch (err: any) {
    console.warn("[bot-orch] Falha ao gravar bot_event_log:", err?.message);
  }
}

export type InactivityDecision =
  | { action: "continue_bot"; reason: string }
  | { action: "skip_bot_run_ai"; reason: string }
  | { action: "silence"; reason: string }
  | { action: "reactivate"; reason: string };

/**
 * Avalia pausa/inatividade antes do bot responder.
 * Doc §5 e §8.
 */
export function evaluateInboundBotGate(params: {
  state: any | null;
  pauseTimeoutMinutes: number;
  instanceBotActive: boolean;
}): InactivityDecision {
  const { state, pauseTimeoutMinutes, instanceBotActive } = params;

  if (!instanceBotActive) {
    if (state && toBool(state.ai_agent_active)) {
      return { action: "skip_bot_run_ai", reason: "INSTANCE_BOT_OFF_AI_ACTIVE" };
    }
    return { action: "silence", reason: "INSTANCE_BOT_OFF" };
  }

  if (!state) {
    return { action: "continue_bot", reason: "NO_STATE" };
  }

  if (toBool(state.manual_pause)) {
    if (toBool(state.ai_agent_active)) {
      return { action: "skip_bot_run_ai", reason: "MANUAL_PAUSE_AI_ACTIVE" };
    }
    return { action: "silence", reason: "MANUAL_PAUSE" };
  }

  // Compat: pausa legada do CRM (is_paused + paused_until) — humano manda, IA off
  if (toBool(state.is_paused) && state.paused_until) {
    const str =
      typeof state.paused_until === "string"
        ? state.paused_until
        : new Date(state.paused_until).toISOString();
    const until = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
    if (Date.now() < until.getTime()) {
      return { action: "silence", reason: "LEGACY_CRM_PAUSE" };
    }
  }

  if (toBool(state.ai_agent_active)) {
    return { action: "skip_bot_run_ai", reason: "AI_AGENT_ACTIVE" };
  }

  const botActive = state.bot_active == null ? true : toBool(state.bot_active);
  const stepEmpty = !state.current_step_id;

  if (!botActive && stepEmpty) {
    return { action: "reactivate", reason: "AUTO_RECOVERY_EMPTY_STEP" };
  }

  if (botActive && !toBool(state.is_paused)) {
    return { action: "continue_bot", reason: "BOT_ACTIVE" };
  }

  // bot_active=false (ou is_paused sem until): religa após pause_timeout desde last_interaction
  const lastRaw = state.last_interaction;
  let elapsedMs = Number.POSITIVE_INFINITY;
  if (lastRaw) {
    const str = typeof lastRaw === "string" ? lastRaw : new Date(lastRaw).toISOString();
    const last = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
    elapsedMs = Date.now() - last.getTime();
  }
  const limitMs = clampPauseTimeoutMinutes(pauseTimeoutMinutes) * 60 * 1000;

  if (elapsedMs >= limitMs) {
    return { action: "reactivate", reason: "TIMEOUT_ELAPSED" };
  }

  return { action: "silence", reason: "WITHIN_TIMEOUT" };
}

export async function reactivateBotFromStart(params: {
  stateId: string;
  tenantId: string;
  contactNumber: string;
  instanceId?: string | null;
  channel?: string;
  reason: string;
}): Promise<void> {
  await dbAdmin
    .from("bot_conversation_state")
    .update({
      bot_active: 1,
      ai_agent_active: 0,
      active_agent_id: null,
      current_step_id: null,
      is_paused: 0,
      paused_until: null,
      last_interaction: new Date().toISOString(),
    })
    .eq("id", params.stateId);

  await logBotEvent({
    tenantId: params.tenantId,
    contactNumber: params.contactNumber,
    instanceId: params.instanceId,
    channel: params.channel,
    eventType: params.reason === "AUTO_RECOVERY_EMPTY_STEP" ? "reactivate_auto_recovery" : "reactivate_timeout",
    details: { reason: params.reason },
  });

  try {
    const { pauseDsAgentSessionsForContact } = await import("./ds-agent-runtime.server");
    await pauseDsAgentSessionsForContact(params.tenantId, params.contactNumber);
  } catch {
    /* optional */
  }
}

/** Prioridade humana (doc §4a) — desliga bot + IA. */
export async function applyHumanCrmIntervention(params: {
  tenantId: string;
  contactNumber: string;
  channel?: string;
  instanceId?: string | null;
}): Promise<void> {
  const { default: db } = await import("./db");
  await ensureBotConversationStateColumns(db);
  const channel = params.channel || "whatsapp";
  const now = new Date();

  const existing = (await db.query(
    `SELECT id FROM bot_conversation_state
     WHERE (tenant_id = ? OR user_id = ?) AND contact_number = ? AND channel = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [params.tenantId, params.tenantId, params.contactNumber, channel],
  )) as Array<{ id: string }>;

  if (existing?.[0]) {
    await db.query(
      `UPDATE bot_conversation_state
       SET bot_active = 0,
           current_step_id = NULL,
           ai_agent_active = 0,
           active_agent_id = NULL,
           is_paused = 1,
           last_interaction = ?,
           tenant_id = COALESCE(tenant_id, ?)
       WHERE id = ?`,
      [now, params.tenantId, existing[0].id],
    );
  } else {
    await db.query(
      `INSERT INTO bot_conversation_state
       (id, tenant_id, user_id, contact_number, instance_id, channel,
        bot_active, current_step_id, ai_agent_active, is_paused, last_interaction)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 0, 1, ?)`,
      [
        crypto.randomUUID(),
        params.tenantId,
        params.tenantId,
        params.contactNumber,
        params.instanceId || "default",
        channel,
        now,
      ],
    );
  }

  await logBotEvent({
    tenantId: params.tenantId,
    contactNumber: params.contactNumber,
    instanceId: params.instanceId,
    channel,
    eventType: "pause_human_crm",
  });

  try {
    const { pauseDsAgentSessionsForContact } = await import("./ds-agent-runtime.server");
    await pauseDsAgentSessionsForContact(params.tenantId, params.contactNumber);
  } catch {
    /* optional */
  }
}

export async function setManualPause(params: {
  tenantId: string;
  contactNumber: string;
  channel: string;
  instanceId: string;
  pause: boolean;
}): Promise<void> {
  const { default: db } = await import("./db");
  await ensureBotConversationStateColumns(db);

  const existing = (await db.query(
    `SELECT id FROM bot_conversation_state
     WHERE user_id = ? AND contact_number = ? AND channel = ?
     LIMIT 1`,
    [params.tenantId, params.contactNumber, params.channel],
  )) as Array<{ id: string }>;

  if (params.pause) {
    if (existing?.[0]) {
      await db.query(
        `UPDATE bot_conversation_state
         SET bot_active = 0, is_paused = 1, manual_pause = 1,
             ai_agent_active = 0, tenant_id = COALESCE(tenant_id, ?)
         WHERE id = ?`,
        [params.tenantId, existing[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO bot_conversation_state
         (id, tenant_id, user_id, contact_number, instance_id, channel,
          bot_active, is_paused, manual_pause, ai_agent_active)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, 1, 0)`,
        [
          crypto.randomUUID(),
          params.tenantId,
          params.tenantId,
          params.contactNumber,
          params.instanceId,
          params.channel,
        ],
      );
    }
    await logBotEvent({
      tenantId: params.tenantId,
      contactNumber: params.contactNumber,
      instanceId: params.instanceId,
      channel: params.channel,
      eventType: "pause_manual",
    });
    try {
      const { pauseDsAgentSessionsForContact } = await import("./ds-agent-runtime.server");
      await pauseDsAgentSessionsForContact(params.tenantId, params.contactNumber);
    } catch {
      /* optional */
    }
  } else {
    // Reativar: limpa manual_pause; ai_agent_active=false; fluxo recomeça pelo menu
    if (existing?.[0]) {
      await db.query(
        `UPDATE bot_conversation_state
         SET bot_active = 1, is_paused = 0, manual_pause = 0,
             ai_agent_active = 0, active_agent_id = NULL,
             current_step_id = NULL, paused_until = NULL,
             tenant_id = COALESCE(tenant_id, ?)
         WHERE id = ?`,
        [params.tenantId, existing[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO bot_conversation_state
         (id, tenant_id, user_id, contact_number, instance_id, channel,
          bot_active, is_paused, manual_pause, ai_agent_active)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0)`,
        [
          crypto.randomUUID(),
          params.tenantId,
          params.tenantId,
          params.contactNumber,
          params.instanceId,
          params.channel,
        ],
      );
    }
    await logBotEvent({
      tenantId: params.tenantId,
      contactNumber: params.contactNumber,
      instanceId: params.instanceId,
      channel: params.channel,
      eventType: "reactivate_manual",
    });
  }
}

export async function activateAiAgentForConversation(params: {
  tenantId: string;
  contactNumber: string;
  instanceId: string;
  channel: string;
  agentId: string | null;
  stateId?: string | null;
}): Promise<void> {
  const { default: db } = await import("./db");
  await ensureBotConversationStateColumns(db);
  const now = new Date().toISOString();
  const payload = {
    bot_active: 1,
    ai_agent_active: 1,
    active_agent_id: params.agentId,
    current_step_id: null,
    is_paused: 0,
    paused_until: null,
    last_interaction: now,
  };

  if (params.stateId) {
    await dbAdmin.from("bot_conversation_state").update(payload).eq("id", params.stateId);
  } else {
    await dbAdmin.from("bot_conversation_state").upsert(
      {
        id: crypto.randomUUID(),
        user_id: params.tenantId,
        tenant_id: params.tenantId,
        contact_number: params.contactNumber,
        instance_id: params.instanceId,
        channel: params.channel,
        ...payload,
      },
      { onConflict: "user_id,contact_number,instance_id,channel" },
    );
  }

  await logBotEvent({
    tenantId: params.tenantId,
    contactNumber: params.contactNumber,
    instanceId: params.instanceId,
    channel: params.channel,
    eventType: "go_to_ai",
    details: { agentId: params.agentId },
  });
}

export async function applyTransferOrPauseSentinel(params: {
  tenantId: string;
  contactNumber: string;
  instanceId: string;
  channel: string;
  stateId?: string | null;
  sentinel: "-998" | "-997" | "-996";
  keepStepId?: string | null;
}): Promise<void> {
  const clearStep = params.sentinel === "-997";
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    bot_active: 0,
    ai_agent_active: 0,
    active_agent_id: null,
    is_paused: 1,
    last_interaction: now,
  };
  if (clearStep) {
    updateData.current_step_id = null;
  } else if (params.keepStepId !== undefined) {
    updateData.current_step_id = params.keepStepId;
  }

  if (params.stateId) {
    await dbAdmin.from("bot_conversation_state").update(updateData).eq("id", params.stateId);
  } else {
    await dbAdmin.from("bot_conversation_state").insert({
      id: crypto.randomUUID(),
      user_id: params.tenantId,
      tenant_id: params.tenantId,
      contact_number: params.contactNumber,
      instance_id: params.instanceId,
      channel: params.channel,
      ...updateData,
    });
  }

  const eventType: BotEventType =
    params.sentinel === "-996" ? "pause_bot" : params.sentinel === "-997" ? "end_flow" : "transfer_human";
  await logBotEvent({
    tenantId: params.tenantId,
    contactNumber: params.contactNumber,
    instanceId: params.instanceId,
    channel: params.channel,
    eventType,
  });

  try {
    const { pauseDsAgentSessionsForContact } = await import("./ds-agent-runtime.server");
    await pauseDsAgentSessionsForContact(params.tenantId, params.contactNumber);
  } catch {
    /* optional */
  }
}

export async function resolveDefaultAiAgentId(
  tenantId: string,
  phoneNumberId: string,
): Promise<string | null> {
  const { default: db } = await import("./db");
  // Prefer DS agent ativo do tenant
  try {
    const ds = (await db.query(
      `SELECT id FROM ds_agents
       WHERE tenant_id = ? AND (is_active = 1 OR is_active = true)
       ORDER BY updated_at DESC LIMIT 1`,
      [tenantId],
    )) as Array<{ id: string }>;
    if (ds?.[0]?.id) return ds[0].id;
  } catch {
    /* continue */
  }
  // Fallback: ai_agent_settings legado ativo na instância
  try {
    const legacy = (await db.query(
      `SELECT id FROM ai_agent_settings
       WHERE user_id = ? AND instance_id = ? AND is_active = 1
       LIMIT 1`,
      [tenantId, phoneNumberId],
    )) as Array<{ id: string }>;
    if (legacy?.[0]?.id) return `legacy:${legacy[0].id}`;
  } catch {
    /* continue */
  }
  return null;
}
