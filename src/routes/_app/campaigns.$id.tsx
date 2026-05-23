import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign, exportCampaignReport } from "@/lib/campaigns.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, Download, MessageSquare, Calendar, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppPreview } from "@/components/whatsapp-preview";

export const Route = createFileRoute("/_app/campaigns/$id")({ component: CampaignDetailPage });

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  queued: { label: "Na fila", cls: "bg-warning/15 text-warning-foreground" },
  running: { label: "Enviando", cls: "bg-primary/15 text-primary" },
  done: { label: "Concluída", cls: "bg-success/15 text-success" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

const MSG_STATUS: Record<string, string> = {
  pending: "Pendente",
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
};

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getCampaign);
  const exportFn = useServerFn(exportCampaignReport);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => fetchOne({ data: { id } }),
    refetchInterval: 5000,
  });

  const exportMut = useMutation({
    mutationFn: () => exportFn({ data: { id } }),
    onSuccess: (r) => {
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportado: ${r.rows} linha(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao exportar"),
  });

  if (isLoading) return <p className="p-10 text-muted-foreground">Carregando…</p>;
  if (!data?.campaign) return <p className="p-10 text-muted-foreground">Campanha não encontrada.</p>;

  const c = data.campaign;
  const t = (c.totals ?? {}) as Record<string, number>;
  const total = t.total ?? 0;
  const sent = (t.sent ?? 0) + (t.delivered ?? 0) + (t.read ?? 0);
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={c.name}
        subtitle={`Criada em ${new Date(c.created_at).toLocaleString("pt-BR")}`}
        action={
          <div className="flex gap-2">
            <Link to="/campaigns"><Button variant="ghost"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button></Link>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
              <Download className="mr-1 h-4 w-4" /> {exportMut.isPending ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto space-y-6 p-6">
        {/* Summary strip */}
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem icon={<span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} />} label="Status">
              <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${s.cls}`}>{s.label}</span>
            </SummaryItem>
            <SummaryItem icon={<Layers className="h-4 w-4 text-muted-foreground" />} label="Tipo">
              <span className="text-sm font-medium capitalize">{c.message_type}</span>
            </SummaryItem>
            <SummaryItem icon={<Users className="h-4 w-4 text-muted-foreground" />} label="Total na fila">
              <span className="text-sm font-medium">{total} contatos</span>
            </SummaryItem>
            <SummaryItem icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="Criada em">
              <span className="text-sm font-medium">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </SummaryItem>
          </div>
        </Card>

        {/* Progress + metrics */}
        <Card className="p-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Progresso de envio</h3>
              <p className="text-xs text-muted-foreground">{pct}% concluído</p>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{sent}<span className="text-base text-muted-foreground">/{total}</span></span>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="Enviadas" value={t.sent ?? 0} />
            <MetricCard label="Entregues" value={t.delivered ?? 0} />
            <MetricCard label="Lidas" value={t.read ?? 0} />
            <MetricCard label="Pendentes" value={t.pending ?? 0} />
            <MetricCard label="Falharam" value={t.failed ?? 0} variant="destructive" />
          </div>
        </Card>

        {/* Two-column: preview + messages log */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <Card className="p-5 lg:sticky lg:top-6 lg:self-start">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Mensagem enviada</h3>
            </div>
            <CampaignMessagePreview campaign={c} template={data.template} />
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <h3 className="font-display text-base font-semibold">Destinatários ({data.messages.length})</h3>
              <p className="text-xs text-muted-foreground">Últimas 500 mensagens da campanha.</p>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Nome</th>
                    <th className="p-3 text-left">Telefone</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Enviada</th>
                    <th className="p-3 text-left">Entregue</th>
                    <th className="p-3 text-left">Lida</th>
                    <th className="p-3 text-left">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.messages.map((m: any) => (
                    <tr key={m.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-xs">{m.contacts?.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3 font-mono text-xs">+{m.to_phone}</td>
                      <td className="p-3">{MSG_STATUS[m.status] ?? m.status}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.delivered_at ? new Date(m.delivered_at).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.read_at ? new Date(m.read_at).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-3 text-xs text-destructive">{m.error ? (typeof m.error === "string" ? m.error : JSON.stringify(m.error).slice(0, 80)) : "—"}</td>
                    </tr>
                  ))}
                  {data.messages.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem mensagens ainda.</td></tr>
                  )}

                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function MetricCard({ label, value, hint, variant }: { label: string; value: number; hint?: string; variant?: "destructive" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${variant === "destructive" ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function CampaignMessagePreview({ campaign, template }: { campaign: any; template: any }) {
  const p = (campaign.payload ?? {}) as any;

  if (campaign.message_type === "template") {
    if (template?.components) {
      const vars = Array.isArray(p.variables) ? p.variables : [];
      return (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Template: <span className="font-medium text-foreground">{template.name}</span>
            {template.language && <> · {template.language}</>}
          </div>
          <WhatsAppPreview
            components={template.components as any}
            variables={Object.fromEntries(vars.map((v: string, i: number) => [String(i + 1), v]))}
          />
        </div>
      );
    }
    return (
      <div className="text-sm text-muted-foreground">
        Template <span className="font-medium text-foreground">{p.template_name ?? "—"}</span> ({p.language ?? "—"})
        {Array.isArray(p.variables) && p.variables.length > 0 && (
          <div className="mt-2 text-xs">Variáveis: {p.variables.join(", ")}</div>
        )}
      </div>
    );
  }

  if (campaign.message_type === "text") {
    return (
      <div className="rounded-lg bg-[#dcf8c6] p-3 text-sm text-[#111] shadow-sm whitespace-pre-wrap max-w-md">
        {p.text || <span className="italic text-muted-foreground">Sem conteúdo.</span>}
      </div>
    );
  }

  if (campaign.message_type === "media") {
    return (
      <div className="space-y-2 max-w-md">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-xs uppercase text-muted-foreground">{p.media_type ?? "mídia"}</div>
          {p.media_type === "image" && p.media_url && (
            <img src={p.media_url} alt="" className="max-h-64 rounded object-contain" />
          )}
          {p.media_type !== "image" && (
            <a href={p.media_url} target="_blank" rel="noreferrer" className="break-all text-xs text-primary underline">
              {p.media_url}
            </a>
          )}
          {p.caption && <p className="mt-2 text-sm whitespace-pre-wrap">{p.caption}</p>}
        </div>
      </div>
    );
  }

  return <pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(p, null, 2)}</pre>;
}
