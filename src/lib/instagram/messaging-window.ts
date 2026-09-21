export const INSTAGRAM_STANDARD_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INSTAGRAM_HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type InstagramWindowState = "standard" | "human_agent" | "closed";
export type InstagramConversationMode = "automated" | "human";
export type InstagramSenderKind = "human" | "automation";

export interface InstagramMessagingWindow {
  state: InstagramWindowState;
  lastInboundAt: string | null;
  expiresAt: string | null;
  humanAgentExpiresAt: string | null;
  canAutomationSend: boolean;
  canHumanSend: boolean;
  requiresHumanAgentTag: boolean;
}

export interface InstagramSendDecision {
  allowed: boolean;
  code: string;
  userMessage: string;
  useHumanAgentTag: boolean;
  window: InstagramMessagingWindow;
  auditAction: string;
}

export function getInstagramMessagingWindow(
  lastInboundAt: Date | string | null | undefined,
  now: Date = new Date(),
): InstagramMessagingWindow {
  const inbound = lastInboundAt ? new Date(lastInboundAt) : null;
  if (!inbound || Number.isNaN(inbound.getTime())) {
    return {
      state: "closed",
      lastInboundAt: null,
      expiresAt: null,
      humanAgentExpiresAt: null,
      canAutomationSend: false,
      canHumanSend: false,
      requiresHumanAgentTag: false,
    };
  }

  const elapsed = now.getTime() - inbound.getTime();
  const expiresAt = new Date(inbound.getTime() + INSTAGRAM_STANDARD_WINDOW_MS).toISOString();
  const humanAgentExpiresAt = new Date(
    inbound.getTime() + INSTAGRAM_HUMAN_AGENT_WINDOW_MS,
  ).toISOString();
  const lastInboundIso = inbound.toISOString();

  if (elapsed <= INSTAGRAM_STANDARD_WINDOW_MS) {
    return {
      state: "standard",
      lastInboundAt: lastInboundIso,
      expiresAt,
      humanAgentExpiresAt,
      canAutomationSend: true,
      canHumanSend: true,
      requiresHumanAgentTag: false,
    };
  }

  if (elapsed <= INSTAGRAM_HUMAN_AGENT_WINDOW_MS) {
    return {
      state: "human_agent",
      lastInboundAt: lastInboundIso,
      expiresAt,
      humanAgentExpiresAt,
      canAutomationSend: false,
      canHumanSend: true,
      requiresHumanAgentTag: true,
    };
  }

  return {
    state: "closed",
    lastInboundAt: lastInboundIso,
    expiresAt,
    humanAgentExpiresAt,
    canAutomationSend: false,
    canHumanSend: false,
    requiresHumanAgentTag: false,
  };
}

export function windowAfterCustomerMessage(
  receivedAt: Date | string,
  now: Date = new Date(receivedAt),
): InstagramMessagingWindow {
  return getInstagramMessagingWindow(receivedAt, now);
}

const CLOSED_USER_MESSAGE =
  "Janela de atendimento encerrada. Aguarde uma nova mensagem do cliente para continuar esta conversa.";

export function decideInstagramSend(input: {
  lastInboundAt: Date | string | null | undefined;
  now?: Date;
  senderKind: InstagramSenderKind;
  conversationMode: InstagramConversationMode;
  humanAgentEnabled: boolean;
  requestedHumanAgentTag?: boolean;
}): InstagramSendDecision {
  const window = getInstagramMessagingWindow(input.lastInboundAt, input.now);

  if (input.senderKind === "automation" && input.requestedHumanAgentTag) {
    return {
      allowed: false,
      code: "HUMAN_AGENT_REQUIRES_AUTHENTICATED_HUMAN",
      userMessage: "Somente um atendente autenticado pode responder fora da janela padrão.",
      useHumanAgentTag: false,
      window,
      auditAction: "AUTOMATION_BLOCKED",
    };
  }

  if (input.senderKind === "automation") {
    if (window.state === "closed") {
      return blocked("cancelled_messaging_window_closed", CLOSED_USER_MESSAGE, window, "MESSAGE_WINDOW_CLOSED");
    }
    if (input.conversationMode === "human") {
      return blocked(
        "cancelled_human_takeover",
        "Atendimento humano ativo. A automação não envia nesta conversa.",
        window,
        "AUTOMATION_BLOCKED",
      );
    }
    if (window.state === "human_agent") {
      return blocked(
        "cancelled_outside_automation_window",
        "Fora da janela padrão de 24h. Somente um atendente humano pode responder.",
        window,
        "AUTOMATION_BLOCKED",
      );
    }
    return allowed(false, window, "STANDARD_MESSAGE_SENT");
  }

  if (window.state === "closed" || !window.canHumanSend) {
    return blocked("MESSAGE_WINDOW_CLOSED", CLOSED_USER_MESSAGE, window, "MESSAGE_WINDOW_CLOSED");
  }

  if (window.state === "human_agent") {
    if (input.conversationMode !== "human") {
      return blocked(
        "HUMAN_TAKEOVER_REQUIRED",
        "Somente atendimento humano disponível. Assuma o atendimento para responder.",
        window,
        "AUTOMATION_BLOCKED",
      );
    }
    if (!input.humanAgentEnabled) {
      return blocked(
        "HUMAN_AGENT_NOT_ENABLED",
        "Atendimento estendido aguardando aprovação da Meta.",
        window,
        "AUTOMATION_BLOCKED",
      );
    }
    return allowed(true, window, "HUMAN_AGENT_MESSAGE_SENT");
  }

  return allowed(false, window, "STANDARD_MESSAGE_SENT");
}

function allowed(
  useHumanAgentTag: boolean,
  window: InstagramMessagingWindow,
  auditAction: string,
): InstagramSendDecision {
  return {
    allowed: true,
    code: "ALLOWED",
    userMessage: "",
    useHumanAgentTag,
    window,
    auditAction,
  };
}

function blocked(
  code: string,
  userMessage: string,
  window: InstagramMessagingWindow,
  auditAction: string,
): InstagramSendDecision {
  return {
    allowed: false,
    code,
    userMessage,
    useHumanAgentTag: false,
    window,
    auditAction,
  };
}

export function formatWindowRemaining(expiresAt: string | null, now: Date = new Date()): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "menos de 1 min";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `cerca de ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return `cerca de ${hours} h`;
}

export function mapInstagramMetaError(body: unknown): string {
  const record = asRecord(body);
  const error = asRecord(record?.error);
  const message = typeof error?.message === "string" ? error.message : "";
  const code = Number(error?.code);
  const subcode = Number(error?.error_subcode);
  const blob = `${message} ${code} ${subcode}`.toLowerCase();

  if (code === 190 || blob.includes("access token") || blob.includes("session has expired")) {
    return "A conta do Instagram precisa ser reconectada.";
  }
  if (blob.includes("human_agent") || blob.includes("human agent")) {
    return "O recurso de atendimento humano estendido ainda não está disponível para esta integração.";
  }
  if (
    blob.includes("outside") ||
    blob.includes("24 hour") ||
    blob.includes("24-hour") ||
    blob.includes("janela")
  ) {
    return "Não é possível responder porque a janela permitida pelo Instagram foi encerrada.";
  }
  if (code === 10 || code === 200 || code === 230 || blob.includes("permission")) {
    return "A integração não possui permissão para realizar esta ação.";
  }
  return "Não foi possível enviar a mensagem no Instagram.";
}

export function metaErrorDetails(body: unknown): {
  code: number | null;
  subcode: number | null;
  fbtraceId: string | null;
} {
  const error = asRecord(asRecord(body)?.error);
  return {
    code: typeof error?.code === "number" ? error.code : null,
    subcode: typeof error?.error_subcode === "number" ? error.error_subcode : null,
    fbtraceId: typeof error?.fbtrace_id === "string" ? error.fbtrace_id : null,
  };
}

export function sanitizeAuditDetail(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== "object") return null;
  const clone = JSON.parse(JSON.stringify(detail)) as Record<string, unknown>;
  stripSecrets(clone);
  return clone;
}

function stripSecrets(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(stripSecrets);
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (/token|secret|authorization|password/i.test(key)) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }
    stripSecrets((value as Record<string, unknown>)[key]);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function isHumanAgentFeatureEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.META_HUMAN_AGENT_ENABLED === "true";
}

export function isInstagramReviewPreviewEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.META_REVIEW_TEST_MODE === "true" && env.NODE_ENV !== "production";
}

export function isInstagramPublicContentEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.META_INSTAGRAM_PUBLIC_CONTENT_ENABLED === "true";
}

export const LAST_INBOUND_SQL = `SELECT created_at
  FROM direct_messages
  WHERE tenant_id = ? AND contact_phone = ? AND channel = 'instagram' AND direction = 'incoming'
  ORDER BY created_at DESC
  LIMIT 1`;
