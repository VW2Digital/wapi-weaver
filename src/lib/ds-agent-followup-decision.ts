/** Decisão pura dos follow-ups do DS Agente. O relógio entra por parâmetro. */

export type FollowupRecurrence = "unico" | "recorrente" | "diario";
export type FollowupWaitUnit = "minutos" | "horas" | "dias";

export type FollowupChatMessage = {
  id: string;
  direction: "incoming" | "outgoing";
  createdAt: number;
  type?: string | null;
  followupId?: string | null;
  channel?: string | null;
};

export type FollowupRunState = "processing" | "sent" | "failed" | "blocked" | "cancelled";

export type FollowupRunRecord = {
  followupId: string;
  sessionId: string;
  cycleKey: string;
  status: FollowupRunState;
  createdAt: number;
  attempt: number;
};

export type FollowupDecision =
  | { action: "skip"; reason: string }
  | {
      action: "cancel";
      reason: "customer_replied" | "session_closed";
      cycleKey: string;
      anchorAt: number;
    }
  | {
      action: "send";
      cycleKey: string;
      anchorAt: number;
      scheduledFor: number;
      attempt: number;
    };

const TECHNICAL_TYPES = new Set([
  "reaction",
  "status",
  "system",
  "internal",
  "note",
  "unsupported",
]);

const PROCESSING_STALE_MS = 5 * 60 * 1000;
const RETRY_GAP_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function waitToMs(amount: number, unit: string): number {
  const n = Math.max(1, Number(amount) || 1);
  const u = String(unit || "minutos").toLowerCase();
  if (u.startsWith("hora")) return n * 60 * 60 * 1000;
  if (u.startsWith("dia")) return n * 24 * 60 * 60 * 1000;
  return n * 60 * 1000;
}

export function assertFollowupWait(amount: number, unit: FollowupWaitUnit): void {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("O tempo de espera precisa ser de pelo menos 1.");
  }
  if (unit === "minutos" && n > 10080) {
    throw new Error("O tempo em minutos não pode passar de 7 dias.");
  }
  if (unit === "horas" && n > 168) {
    throw new Error("O tempo em horas não pode passar de 7 dias.");
  }
  if (unit === "dias" && n > 30) {
    throw new Error("O tempo em dias não pode passar de 30.");
  }
}

export function isTechnicalFollowupMessage(message: { type?: string | null }): boolean {
  return TECHNICAL_TYPES.has(String(message.type || "").toLowerCase());
}

export function saoPauloDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function applyLeadName(template: string, leadName: string): string {
  const name = String(leadName || "").trim();
  return String(template || "")
    .replace(/\{\{\s*nome_lead\s*\}\}/gi, name)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function resolveFollowupBody(params: {
  type: "manual" | "generativo";
  template: string;
  leadName: string;
  generated: string | null;
}): { text: string; source: "manual" | "generated" } {
  if (params.type === "generativo") {
    return { text: String(params.generated || "").trim(), source: "generated" };
  }
  return { text: applyLeadName(params.template, params.leadName), source: "manual" };
}

export function followupChannelDecision(
  channel: string | null | undefined,
): { ok: true; channel: "whatsapp" } | { ok: false; reason: string } {
  const value = String(channel || "whatsapp").toLowerCase();
  if (value === "whatsapp" || value === "") {
    return { ok: true, channel: "whatsapp" };
  }
  if (value === "instagram") {
    return {
      ok: false,
      reason:
        "Instagram sem envio automático deste follow-up. A Bliv não contorna a janela nem o tipo de mensagem exigido pela plataforma.",
    };
  }
  return { ok: false, reason: `Canal ${value} sem envio automático de follow-up.` };
}

export function classifyFollowupSendError(
  status: number,
  body: string,
): { state: "blocked" | "failed"; reason: string } {
  let code: number | undefined;
  try {
    const parsed = JSON.parse(body) as { error?: { code?: number; message?: string } };
    code = parsed?.error?.code;
  } catch {
    code = undefined;
  }
  const text = String(body || "").slice(0, 300);
  if (code === 131047 || /re-engagement|24 hours|24 horas/i.test(text)) {
    return {
      state: "blocked",
      reason: "Fora da janela de 24 horas do WhatsApp. A Meta não permite esta mensagem livre.",
    };
  }
  if (code === 131026 || code === 131051) {
    return { state: "blocked", reason: "A Meta recusou a entrega desta mensagem." };
  }
  if (status === 401 || status === 403 || code === 190 || code === 10) {
    return { state: "blocked", reason: "Credencial do canal sem permissão para enviar." };
  }
  return { state: "failed", reason: text || `HTTP ${status}` };
}

function cycleKeyOf(message: FollowupChatMessage): string {
  return message.id || String(message.createdAt);
}

function relevantMessages(messages: FollowupChatMessage[]): FollowupChatMessage[] {
  return messages
    .filter((message) => !isTechnicalFollowupMessage(message))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

function runsForCycle(runs: FollowupRunRecord[], followupId: string, sessionId: string, cycleKey: string) {
  return runs.filter(
    (run) => run.followupId === followupId && run.sessionId === sessionId && run.cycleKey === cycleKey,
  );
}

function hasTerminal(runs: FollowupRunRecord[]): boolean {
  return runs.some((run) => run.status === "sent" || run.status === "blocked" || run.status === "cancelled");
}

export function decideFollowup(params: {
  now: number;
  followupId: string;
  sessionId: string;
  active: boolean;
  recurrence: FollowupRecurrence;
  waitAmount: number;
  waitUnit: string;
  sessionStatus: string;
  messages: FollowupChatMessage[];
  runs: FollowupRunRecord[];
}): FollowupDecision {
  if (!params.active) return { action: "skip", reason: "inactive" };

  const messages = relevantMessages(params.messages);
  const lastOutgoing = [...messages].reverse().find((message) => message.direction === "outgoing");

  if (params.sessionStatus !== "active") {
    if (!lastOutgoing) return { action: "skip", reason: "session_closed" };
    const cycleKey = cycleKeyOf(lastOutgoing);
    if (hasTerminal(runsForCycle(params.runs, params.followupId, params.sessionId, cycleKey))) {
      return { action: "skip", reason: "session_closed" };
    }
    return {
      action: "cancel",
      reason: "session_closed",
      cycleKey,
      anchorAt: lastOutgoing.createdAt,
    };
  }

  const last = messages[messages.length - 1];
  if (!last) return { action: "skip", reason: "no_agent_message" };

  if (last.direction === "incoming") {
    const anchor = [...messages].reverse().find((message) => message.direction === "outgoing");
    if (!anchor) return { action: "skip", reason: "customer_spoke_last" };
    const cycleKey = cycleKeyOf(anchor);
    if (hasTerminal(runsForCycle(params.runs, params.followupId, params.sessionId, cycleKey))) {
      return { action: "skip", reason: "customer_spoke_last" };
    }
    return {
      action: "cancel",
      reason: "customer_replied",
      cycleKey,
      anchorAt: anchor.createdAt,
    };
  }

  const anchor =
    params.recurrence === "unico"
      ? [...messages].reverse().find((message) => message.direction === "outgoing" && message.followupId !== params.followupId)
      : last;
  if (!anchor) return { action: "skip", reason: "no_agent_message" };

  const cycleKey = cycleKeyOf(anchor);
  const waitMs = waitToMs(params.waitAmount, params.waitUnit);
  if (params.now - anchor.createdAt < waitMs) {
    return { action: "skip", reason: "waiting" };
  }

  if (params.recurrence === "diario") {
    const today = saoPauloDay(params.now);
    const sentToday = params.runs.some(
      (run) =>
        run.followupId === params.followupId &&
        run.sessionId === params.sessionId &&
        run.status === "sent" &&
        saoPauloDay(run.createdAt) === today,
    );
    if (sentToday) return { action: "skip", reason: "daily_limit" };
  }

  const existing = runsForCycle(params.runs, params.followupId, params.sessionId, cycleKey);
  if (hasTerminal(existing)) return { action: "skip", reason: "already_sent" };

  const processing = existing.find((run) => run.status === "processing");
  if (processing && params.now - processing.createdAt < PROCESSING_STALE_MS) {
    return { action: "skip", reason: "in_progress" };
  }

  const failed = [...existing.filter((run) => run.status === "failed")].sort((a, b) => b.createdAt - a.createdAt)[0];
  const attempt = (failed?.attempt || processing?.attempt || 0) + 1;
  if (failed && failed.attempt >= MAX_ATTEMPTS) return { action: "skip", reason: "retries_exhausted" };
  if (failed && params.now - failed.createdAt < RETRY_GAP_MS) return { action: "skip", reason: "retry_wait" };

  return {
    action: "send",
    cycleKey,
    anchorAt: anchor.createdAt,
    scheduledFor: anchor.createdAt + waitMs,
    attempt,
  };
}
