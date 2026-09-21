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

export function InstagramAttentionBar({
  state,
  preview,
  onPreview,
  onAssume,
  onResume,
  busy,
}: {
  state: InstagramAttentionView;
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

  return (
    <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium">{modeLabel}</span>
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium">
          {WINDOW_LABEL[shown]}
        </span>
        {state.mode === "human" && state.attendantName ? (
          <span>Atendente: {state.attendantName}</span>
        ) : null}
      </div>
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
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onAssume}>
            Assumir atendimento
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={busy || state.window.state !== "standard"} onClick={onResume}>
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
    </div>
  );
}
