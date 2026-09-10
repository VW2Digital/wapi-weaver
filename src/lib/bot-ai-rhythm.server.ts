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
 * Fail-open: erro de DB NÃO deve silenciar a IA.
 */
export async function hasRecentAiReplyAfterLastCustomer(params: {
  tenantId: string;
  contactPhone: string;
}): Promise<boolean> {
  try {
    const { default: db } = await import("./db");

    // Queries leves (LIMIT 1 / 10) para evitar filesort grande em direct_messages.
    const lastIn = (await db.query(
      `SELECT created_at
       FROM direct_messages
       WHERE (tenant_id = ? OR user_id = ?)
         AND contact_phone = ?
         AND direction = 'incoming'
       ORDER BY created_at DESC
       LIMIT 1`,
      [params.tenantId, params.tenantId, params.contactPhone],
    )) as Array<{ created_at: string | Date }>;

    if (!lastIn?.[0]?.created_at) return false;

    const lastRaw = lastIn[0].created_at;
    const lastStr =
      typeof lastRaw === "string" ? lastRaw : new Date(lastRaw).toISOString();
    const lastCustomerAt = new Date(
      lastStr.includes("Z") || lastStr.includes("+") ? lastStr : lastStr.replace(" ", "T") + "Z",
    );

    const outs = (await db.query(
      `SELECT created_at, metadata
       FROM direct_messages
       WHERE (tenant_id = ? OR user_id = ?)
         AND contact_phone = ?
         AND direction = 'outgoing'
         AND created_at >= ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [
        params.tenantId,
        params.tenantId,
        params.contactPhone,
        lastCustomerAt.toISOString().slice(0, 19).replace("T", " "),
      ],
    )) as Array<{ created_at: string | Date; metadata: any }>;

    for (const m of outs || []) {
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
      if (!isAi) continue;

      const str =
        typeof m.created_at === "string" ? m.created_at : new Date(m.created_at).toISOString();
      const at = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
      if (at.getTime() >= lastCustomerAt.getTime() && Date.now() - at.getTime() <= ANTI_DUP_MS) {
        return true;
      }
    }
    return false;
  } catch (err: any) {
    console.warn(
      "[bot-ai-rhythm] hasRecentAiReplyAfterLastCustomer falhou (fail-open):",
      err?.message || err,
    );
    return false;
  }
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
  try {
    if (params.proactiveGreeting) {
      return { skip: false, reason: "PROACTIVE_BYPASS" };
    }
    if (await hasRecentAiReplyAfterLastCustomer(params)) {
      return { skip: true, reason: "ANTI_DUPLICITY" };
    }
    return { skip: false, reason: "OK" };
  } catch (err: any) {
    console.warn("[bot-ai-rhythm] shouldSkipAiCall falhou (fail-open):", err?.message || err);
    return { skip: false, reason: "RHYTHM_ERROR_FAIL_OPEN" };
  }
}
