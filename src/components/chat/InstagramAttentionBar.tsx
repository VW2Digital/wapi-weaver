import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWindowRemaining, type InstagramWindowState } from "@/lib/instagram/messaging-window";

export interface InstagramAttentionView {
  igAccountLabel?: string | null;
  lastInboundAt?: string | null;
  window: {
    state: InstagramWindowState;
    expiresAt: string | null;
    humanAgentExpiresAt: string | null;
  };
  mode: "automated" | "human";
  attendantName?: string | null;
  humanAgentEnabled: boolean;
  reviewPreviewEnabled: boolean;
  composerEnabled: boolean;
  blockMessage?: string | null;
}

const WINDOW_LABEL: Record<InstagramWindowState, string> = {
  standard: "Janela de atendimento ativa",
  human_agent: "Somente atendimento humano disponível",
  closed: "Janela de atendimento encerrada",
};

const BADGE_GREEN =
  "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400";
const BADGE_AMBER =
  "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400";
const BADGE_MUTED =
  "rounded-md border border-border bg-background px-2 py-0.5 font-medium text-muted-foreground";

function windowBadgeClass(state: InstagramWindowState) {
  if (state === "standard") return BADGE_GREEN;
  if (state === "human_agent") return BADGE_AMBER;
  return BADGE_MUTED;
}

function attentionStorageKey(storageId: string) {
  return `bliv:ig-attention-collapsed:${storageId}`;
}

function isAttentionCollapsed(storageId: string, noticeKey: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(attentionStorageKey(storageId)) === noticeKey;
  } catch {
    return false;
  }
}

function persistAttentionCollapsed(storageId: string, noticeKey: string, collapsed: boolean) {
  try {
    const key = attentionStorageKey(storageId);
    if (collapsed) window.localStorage.setItem(key, noticeKey);
    else window.localStorage.removeItem(key);
  } catch {
    // O aviso continua utilizável se o navegador bloquear o armazenamento.
  }
}

export function InstagramAttentionBar({
  state,
  storageId,
  preview,
  onPreview,
  onAssume,
  onResume,
  busy,
}: {
  state: InstagramAttentionView;
  storageId: string;
  preview: InstagramWindowState | null;
  onPreview: (value: InstagramWindowState | null) => void;
  onAssume: () => void;
  onResume: () => void;
  busy: boolean;
}) {
  const shown = preview || state.window.state;
  const modeLabel = state.mode === "human" ? "Atendimento humano ativo" : "Automação ativa";
  const lastInbound = state.lastInboundAt
    ? new Date(state.lastInboundAt).toLocaleString("pt-BR")
    : "sem mensagem do cliente";
  const noticeKey = `${state.mode}:${state.window.state}:${state.lastInboundAt || ""}`;
  const [collapsed, setCollapsed] = useState(() => isAttentionCollapsed(storageId, noticeKey));

  useEffect(() => {
    setCollapsed(isAttentionCollapsed(storageId, noticeKey));
  }, [storageId, noticeKey]);

  return (
    <div className={`border-b border-border/60 bg-muted/30 px-3 text-xs text-foreground ${collapsed ? "py-1.5" : "space-y-2 py-2"}`}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className={state.mode === "human" ? BADGE_GREEN : BADGE_AMBER}>{modeLabel}</span>
          <span className={windowBadgeClass(shown)}>{WINDOW_LABEL[shown]}</span>
          {state.mode === "human" && state.attendantName ? (
            <span className="truncate">Atendente: {state.attendantName}</span>
          ) : null}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          title={collapsed ? "Mostrar detalhes" : "Fechar aviso"}
          onClick={() =>
            setCollapsed((open) => {
              const next = !open;
              persistAttentionCollapsed(storageId, noticeKey, next);
              return next;
            })
          }
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {collapsed ? null : (
        <>
      <p className="text-muted-foreground">
        Conta conectada: {state.igAccountLabel || "Instagram"} · Última mensagem do cliente: {lastInbound}
        {shown === "standard" && state.window.expiresAt
          ? ` · Resta ${formatWindowRemaining(state.window.expiresAt)}`
          : ""}
        {shown === "human_agent"
          ? " · Fora da janela padrão de 24h. Somente um atendente humano pode responder."
          : ""}
        {shown === "closed"
          ? " · Aguarde uma nova mensagem do cliente para continuar esta conversa."
          : ""}
      </p>
      {state.blockMessage && shown === state.window.state ? (
        <p className="text-amber-700 dark:text-amber-400">{state.blockMessage}</p>
      ) : null}
      {!state.humanAgentEnabled && state.window.state === "human_agent" ? (
        <p>Atendimento estendido aguardando aprovação da Meta.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {state.mode !== "human" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onAssume}
            className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
          >
            Assumir atendimento
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={busy || state.window.state !== "standard"}
            onClick={onResume}
            className="border-amber-500 bg-amber-500 text-amber-950 hover:bg-amber-400 hover:text-amber-950 disabled:opacity-60"
          >
            Devolver para automação
          </Button>
        )}
      </div>
      {state.reviewPreviewEnabled ? (
        <label className="flex items-center gap-2 text-muted-foreground">
          Pré-visualização (não altera o envio real)
          <select
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            value={preview || ""}
            onChange={(event) =>
              onPreview((event.target.value || null) as InstagramWindowState | null)
            }
          >
            <option value="">Janela real</option>
            <option value="standard">Janela padrão</option>
            <option value="human_agent">Somente atendimento humano</option>
            <option value="closed">Janela encerrada</option>
          </select>
        </label>
      ) : null}
        </>
      )}
    </div>
  );
}
