/**
 * Ritmo de resposta da IA (doc §6):
 * - lock 60s
 * - debounce 8–13s
 * - antiduplicidade 15s (respostas humanas não contam)
 * - saudação proativa pula debounce/antiduplicidade
 */
import { ensureBotConversationStateColumns, toBool } from "./bot-conversation-orchestration.server";

const LOCK_MS = 60_000;
const ANTI_DUP_MS = 15_000;

export function randomDebounceMs(): number {
  return 8000 + Math.floor(Math.random() * 5001); // 8–13s
}

export async function acquireAiConversationLock(params: {
  tenantId: string;
  contactNumber: string;
  channel?: string;
  stateId?: string | null;
}): Promise<{ ok: boolean; reason: string }> {
  const { default: db } = await import("./db");
  await ensureBotConversationStateColumns(db);
  const channel = params.channel || "whatsapp";
  const now = new Date();

  const rows = (await db.query(
    `SELECT id, locked, locked_at FROM bot_conversation_state
     WHERE (tenant_id = ? OR user_id = ?) AND contact_number = ? AND channel = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [params.tenantId, params.tenantId, params.contactNumber, channel],
  )) as Array<{ id: string; locked: number | boolean; locked_at: string | Date | null }>;

  const row = rows?.[0];
  if (row && toBool(row.locked) && row.locked_at) {
    const str =
      typeof row.locked_at === "string" ? row.locked_at : new Date(row.locked_at).toISOString();
    const lockedAt = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
    if (Date.now() - lockedAt.getTime() < LOCK_MS) {
      return { ok: false, reason: "LOCKED" };
    }
  }

  const targetId = params.stateId || row?.id;
  if (targetId) {
    await db.query(
      `UPDATE bot_conversation_state SET locked = 1, locked_at = ? WHERE id = ?`,
      [now, targetId],
    );
  }
  return { ok: true, reason: "ACQUIRED" };
}

export async function releaseAiConversationLock(params: {
  tenantId: string;
  contactNumber: string;
  channel?: string;
  stateId?: string | null;
}): Promise<void> {
  const { default: db } = await import("./db");
  if (params.stateId) {
    await db.query(`UPDATE bot_conversation_state SET locked = 0 WHERE id = ?`, [params.stateId]);
    return;
  }
  await db.query(
    `UPDATE bot_conversation_state SET locked = 0
     WHERE (tenant_id = ? OR user_id = ?) AND contact_number = ? AND channel = ?`,
    [params.tenantId, params.tenantId, params.contactNumber, params.channel || "whatsapp"],
  );
}

/**
 * true = já existe resposta de IA após a última msg do cliente (janela 15s) → descartar.
 * Respostas humanas (outgoing sem metadata de IA) não contam.
 */
export async function hasRecentAiReplyAfterLastCustomer(params: {
  tenantId: string;
  contactPhone: string;
}): Promise<boolean> {
  const { default: db } = await import("./db");
  const msgs = (await db.query(
    `SELECT direction, created_at, metadata
     FROM direct_messages
     WHERE tenant_id = ? AND contact_phone = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [params.tenantId, params.contactPhone],
  )) as Array<{ direction: string; created_at: string | Date; metadata: any }>;

  if (!msgs?.length) return false;

  let lastCustomerAt: Date | null = null;
  for (const m of msgs) {
    if (m.direction === "incoming") {
      const str =
        typeof m.created_at === "string" ? m.created_at : new Date(m.created_at).toISOString();
      lastCustomerAt = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
      break;
    }
  }
  if (!lastCustomerAt) return false;

  for (const m of msgs) {
    if (m.direction !== "outgoing") continue;
    let meta = m.metadata;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = {};
      }
    }
    const isAi =
      Boolean(meta?.ds_agent) ||
      Boolean(meta?.ai_agent) ||
      Boolean(meta?.ds_agent_id) ||
      meta?.source === "ai_agent";
    if (!isAi) continue; // humano não conta

    const str =
      typeof m.created_at === "string" ? m.created_at : new Date(m.created_at).toISOString();
    const at = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
    if (at.getTime() >= lastCustomerAt.getTime() && Date.now() - at.getTime() <= ANTI_DUP_MS) {
      return true;
    }
  }
  return false;
}

export async function waitAiDebounce(ms?: number): Promise<void> {
  const wait = typeof ms === "number" ? ms : randomDebounceMs();
  await new Promise((r) => setTimeout(r, wait));
}

export async function shouldSkipAiCall(params: {
  tenantId: string;
  contactPhone: string;
  proactiveGreeting?: boolean;
}): Promise<{ skip: boolean; reason: string }> {
  if (params.proactiveGreeting) {
    return { skip: false, reason: "PROACTIVE_BYPASS" };
  }
  if (await hasRecentAiReplyAfterLastCustomer(params)) {
    return { skip: true, reason: "ANTI_DUPLICITY" };
  }
  return { skip: false, reason: "OK" };
}
