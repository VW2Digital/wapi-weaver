import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  FileCheck,
  Tag,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { listMyWebhookEvents } from "@/lib/webhook-events.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/webhook-events")({
  component: WebhookEventsPage,
});

type EventRow = {
  id: string;
  source: string;
  processed: boolean;
  received_at: string;
  raw: any;
};

type Summary = {
  kind:
    | "template_status"
    | "template_category"
    | "message_status"
    | "inbound"
    | "other";
  title: string;
  description: string;
  status?: "approved" | "rejected" | "pending" | "paused" | "disabled" | "sent" | "delivered" | "read" | "failed" | "info";
  icon: typeof Activity;
};

function summarize(raw: any): Summary[] {
  const out: Summary[] = [];
  const entries = raw?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (change.field === "message_template_status_update") {
        const event = String(v.event ?? "").toUpperCase();
        const name = v.message_template_name ?? "template";
        const lang = v.message_template_language ?? "";
        const reason = v.reason ? ` — ${v.reason}` : "";
        const map: Record<string, Summary["status"]> = {
          APPROVED: "approved",
          REJECTED: "rejected",
          PENDING: "pending",
          IN_APPEAL: "pending",
          PENDING_DELETION: "pending",
          DELETED: "disabled",
          DISABLED: "disabled",
          PAUSED: "paused",
          FLAGGED: "paused",
          REINSTATED: "approved",
        };
        out.push({
          kind: "template_status",
          title: `Template "${name}" — ${event.toLowerCase().replace(/_/g, " ")}`,
          description: `Idioma ${lang}${reason}`,
          status: map[event] ?? "info",
          icon: FileCheck,
        });
      } else if (change.field === "template_category_update") {
        out.push({
          kind: "template_category",
          title: `Categoria do template alterada`,
          description: `${v.previous_category ?? "?"} → ${v.new_category ?? "?"}`,
          status: "info",
          icon: Tag,
        });
      } else if (change.field === "messages") {
        for (const s of v.statuses ?? []) {
          const status = (s.status as string) ?? "info";
          const statusMap: Record<string, Summary["status"]> = {
            sent: "sent",
            delivered: "delivered",
            read: "read",
            failed: "failed",
          };
          const errMsg = s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? "";
          out.push({
            kind: "message_status",
            title: `Mensagem ${status}`,
            description: `Para ${s.recipient_id ?? "—"}${errMsg ? ` · ${errMsg}` : ""}`,
            status: statusMap[status] ?? "info",
            icon: MessageSquare,
          });
        }
        for (const m of v.messages ?? []) {
          const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "(mídia)";
          out.push({
            kind: "inbound",
            title: `Mensagem recebida de ${m.from ?? "—"}`,
            description: text.toString().slice(0, 120),
            status: "info",
            icon: Inbox,
          });
        }
      } else {
        out.push({
          kind: "other",
          title: change.field ?? "Evento",
          description: "Evento recebido do WhatsApp",
          status: "info",
          icon: Activity,
        });
      }
    }
  }
  if (out.length === 0) {
    out.push({
      kind: "other",
      title: "Evento recebido",
      description: "Sem detalhes estruturados",
      status: "info",
      icon: Activity,
    });
  }
  return out;
}

function StatusBadge({ status }: { status?: Summary["status"] }) {
  const cfg: Record<NonNullable<Summary["status"]>, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", Icon: CheckCircle2 },
    rejected: { label: "Rejeitado", cls: "bg-red-500/10 text-red-600 border-red-500/20", Icon: XCircle },
    pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", Icon: Clock },
    paused: { label: "Pausado", cls: "bg-orange-500/10 text-orange-600 border-orange-500/20", Icon: AlertTriangle },
    disabled: { label: "Desativado", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
    sent: { label: "Enviada", cls: "bg-sky-500/10 text-sky-600 border-sky-500/20", Icon: CheckCircle2 },
    delivered: { label: "Entregue", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20", Icon: CheckCircle2 },
    read: { label: "Lida", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", Icon: CheckCircle2 },
    failed: { label: "Falhou", cls: "bg-red-500/10 text-red-600 border-red-500/20", Icon: XCircle },
    info: { label: "Info", cls: "bg-muted text-muted-foreground border-border", Icon: Activity },
  };
  const { label, cls, Icon } = cfg[status ?? "info"];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function WebhookEventsPage() {
  const fetchEvents = useServerFn(listMyWebhookEvents);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "template" | "message" | "inbound">("all");
  const [selected, setSelected] = useState<EventRow | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["my-webhook-events"],
    queryFn: () => fetchEvents({ data: { limit: 200 } }),
    refetchInterval: 15000,
  });

  const events = (data?.events ?? []) as EventRow[];

  const enriched = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        summaries: summarize(e.raw),
      })),
    [events],
  );

  const filtered = useMemo(() => {
    return enriched.filter((e) => {
      if (filter !== "all") {
        const has = e.summaries.some((s) =>
          filter === "template"
            ? s.kind.startsWith("template")
            : filter === "message"
              ? s.kind === "message_status"
              : s.kind === "inbound",
        );
        if (!has) return false;
      }
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        e.summaries.some((x) => x.title.toLowerCase().includes(s) || x.description.toLowerCase().includes(s)) ||
        JSON.stringify(e.raw).toLowerCase().includes(s)
      );
    });
  }, [enriched, filter, search]);

  const stats = useMemo(() => {
    let approved = 0, rejected = 0, pending = 0, delivered = 0, failed = 0;
    for (const e of enriched) {
      for (const s of e.summaries) {
        if (s.status === "approved") approved++;
        else if (s.status === "rejected") rejected++;
        else if (s.status === "pending" || s.status === "paused") pending++;
        else if (s.status === "delivered" || s.status === "read") delivered++;
        else if (s.status === "failed") failed++;
      }
    }
    return { approved, rejected, pending, delivered, failed, total: events.length };
  }, [enriched, events.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Eventos do Webhook"
        subtitle="Acompanhe em tempo real o status de aprovação de templates, entregas e respostas dos seus contatos."
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="mt-1 font-display text-2xl font-semibold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Aprovados</div>
            <div className="mt-1 font-display text-2xl font-semibold text-emerald-600">{stats.approved}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="mt-1 font-display text-2xl font-semibold text-amber-600">{stats.pending}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Rejeitados</div>
            <div className="mt-1 font-display text-2xl font-semibold text-red-600">{stats.rejected}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Entregues</div>
            <div className="mt-1 font-display text-2xl font-semibold text-blue-600">{stats.delivered}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Falhas</div>
            <div className="mt-1 font-display text-2xl font-semibold text-red-600">{stats.failed}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <Input
            placeholder="Buscar nos eventos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { k: "all", label: "Todos" },
              { k: "template", label: "Templates" },
              { k: "message", label: "Mensagens" },
              { k: "inbound", label: "Recebidas" },
            ].map((f) => (
              <Button
                key={f.k}
                size="sm"
                variant={filter === f.k ? "default" : "outline"}
                onClick={() => setFilter(f.k as typeof filter)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Timeline */}
        <Card className="overflow-hidden p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nenhum evento ainda"
              description="Quando a Meta enviar atualizações sobre seus templates ou mensagens, elas aparecerão aqui em tempo real."
            />
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => {
                const primary = e.summaries[0];
                const Icon = primary.icon;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => setSelected(e)}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{primary.title}</span>
                          <StatusBadge status={primary.status} />
                          {e.summaries.length > 1 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{e.summaries.length - 1} evento{e.summaries.length - 1 > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{primary.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-medium text-muted-foreground">{timeAgo(e.received_at)}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(e.received_at).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
            <DialogDescription>
              Recebido em {selected && new Date(selected.received_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 overflow-y-auto">
              <div className="space-y-2">
                {summarize(selected.raw).map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <s.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.title}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <details className="rounded-lg border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                  Payload bruto (JSON)
                </summary>
                <pre className="max-h-72 overflow-auto bg-muted/40 p-3 text-[11px]">
                  {JSON.stringify(selected.raw, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
