import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listContacts } from "@/lib/contacts.functions";
import { listTemplates } from "@/lib/templates.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Send, Users, FileText, CheckCircle2, TrendingUp, TrendingDown, Minus, Target, Eye, AlertTriangle, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

const STATUS_HEX: Record<string, string> = {
  pending: "var(--chart-5)",
  sent: "var(--chart-4)",
  delivered: "var(--chart-3)",
  read: "var(--chart-2)",
  failed: "var(--chart-1)",
};

const STATUS_KEYS = ["pending", "sent", "delivered", "read", "failed"] as const;
const STATUS_LABEL: Record<(typeof STATUS_KEYS)[number], string> = {
  pending: "Pendente",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
};
const STATUS_COLOR: Record<(typeof STATUS_KEYS)[number], string> = {
  pending: "bg-chart-5",
  sent: "bg-chart-4",
  delivered: "bg-chart-3",
  read: "bg-chart-2",
  failed: "bg-chart-1",
};

function Dashboard() {
  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchContacts = useServerFn(listContacts);
  const fetchTemplates = useServerFn(listTemplates);
  const fetchStats = useServerFn(getDashboardStats);

  const c = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchCampaigns() });
  const ct = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });
  const t = useQuery({ queryKey: ["templates"], queryFn: () => fetchTemplates() });
  const s = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fetchStats() });

  const totals = (c.data ?? []).reduce(
    (acc, x: any) => {
      const t = x.totals ?? {};
      acc.sent += t.sent ?? 0;
      acc.delivered += t.delivered ?? 0;
      acc.read += t.read ?? 0;
      acc.failed += t.failed ?? 0;
      return acc;
    },
    { sent: 0, delivered: 0, read: 0, failed: 0 },
  );

  const deliverRate = totals.sent ? Math.round((totals.delivered / totals.sent) * 100) : 0;
  const readRate = totals.delivered ? Math.round((totals.read / totals.delivered) * 100) : 0;

  function trend(current: number, previous: number) {
    if (previous === 0) {
      return { delta: current > 0 ? 100 : 0, raw: current, isNew: current > 0 };
    }
    const delta = Math.round(((current - previous) / previous) * 100);
    return { delta, raw: current - previous, isNew: false };
  }

  const stats = [
    {
      label: "Contatos",
      value: ct.data?.length ?? s.data?.contacts.current ?? 0,
      icon: Users,
      trend: s.data ? trend(s.data.contacts.current, s.data.contacts.previous) : null,
      loading: ct.isPending && s.isPending,
    },
    {
      label: "Templates",
      value: t.data?.length ?? s.data?.templates.current ?? 0,
      icon: FileText,
      trend: s.data ? trend(s.data.templates.current, s.data.templates.previous) : null,
      loading: t.isPending && s.isPending,
    },
    {
      label: "Campanhas",
      value: c.data?.length ?? s.data?.campaigns.current ?? 0,
      icon: Send,
      trend: s.data ? trend(s.data.campaigns.current, s.data.campaigns.previous) : null,
      loading: c.isPending && s.isPending,
    },
    {
      label: "Entregas (7d)",
      value: s.data?.delivered.current ?? totals.delivered,
      icon: CheckCircle2,
      trend: s.data ? trend(s.data.delivered.current, s.data.delivered.previous) : null,
      loading: s.isPending,
    },
  ];

  const pieData = [
    { key: "delivered", name: "Entregue", value: totals.delivered },
    { key: "read", name: "Lida", value: totals.read },
    { key: "sent", name: "Enviada", value: Math.max(totals.sent - totals.delivered, 0) },
    { key: "failed", name: "Falhou", value: totals.failed },
  ].filter((d) => d.value > 0);

  const barData = (c.data ?? [])
    .slice(0, 8)
    .map((x: any) => {
      const t = (x.totals ?? {}) as Record<string, number>;
      const name = String(x.name ?? "—");
      return {
        name: name.length > 14 ? name.slice(0, 14) + "…" : name,
        Entregue: t.delivered ?? 0,
        Lida: t.read ?? 0,
        Falhou: t.failed ?? 0,
      };
    });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral dos seus disparos via WhatsApp Cloud API."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/contacts">
                <Users className="h-4 w-4" />
                Importar contatos
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/templates">
                <FileText className="h-4 w-4" />
                Criar template
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/campaigns">
                <Plus className="h-4 w-4" />
                Nova campanha
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {(() => {
          if (c.isPending) return null;
          const failureRate = totals.sent ? Math.round((totals.failed / totals.sent) * 100) : 0;
          const alerts: { title: string; description: string }[] = [];
          if (totals.failed > 0) {
            alerts.push({
              title: `${totals.failed.toLocaleString("pt-BR")} ${totals.failed === 1 ? "mensagem falhou" : "mensagens falharam"}`,
              description:
                failureRate >= 5
                  ? `Taxa de falha de ${failureRate}% — verifique credenciais do WhatsApp Cloud, número e status dos templates.`
                  : "Confira as campanhas com falhas para detalhes do erro.",
            });
          }
          if (totals.sent >= 20 && deliverRate < 70) {
            alerts.push({
              title: `Taxa de entrega baixa: ${deliverRate}%`,
              description: "Abaixo de 70%. Revise a qualidade dos números e o template usado.",
            });
          }
          if (alerts.length === 0) return null;
          return (
            <div className="space-y-2 px-4 pt-4 sm:px-6 sm:pt-6">
              {alerts.map((a) => (
                <Alert key={a.title} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{a.title}</AlertTitle>
                  <AlertDescription>{a.description}</AlertDescription>
                </Alert>
              ))}
            </div>
          );
        })()}

        <section aria-labelledby="bento-heading" className="p-4 sm:p-6">
          <h2 id="bento-heading" className="sr-only">Visão geral</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 lg:grid-cols-6 lg:auto-rows-[7rem]">
            {/* Hero tile — Taxa de entrega (bento highlight) */}
            <Card className="col-span-2 sm:col-span-4 lg:col-span-3 lg:row-span-2 relative overflow-hidden p-5 sm:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-90"
                style={{
                  background:
                    "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--primary) 28%, transparent) 0%, transparent 55%), radial-gradient(80% 60% at 0% 100%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%)",
                }}
              />
              <div className="relative flex h-full flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Taxa de entrega</p>
                    {c.isPending ? (
                      <Skeleton className="mt-2 h-10 w-32" />
                    ) : (
                      <p className="mt-1 font-display text-4xl font-semibold leading-none sm:text-5xl">
                        {deliverRate}<span className="ml-1 text-2xl text-muted-foreground sm:text-3xl">%</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {totals.delivered.toLocaleString("pt-BR")} de {totals.sent.toLocaleString("pt-BR")} mensagens entregues
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-primary/15 p-2.5 text-primary">
                    <Target className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.min(deliverRate, 100)}%` }}
                    role="progressbar"
                    aria-valuenow={deliverRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Taxa de entrega"
                  />
                </div>
              </div>
            </Card>

            {/* Stat tiles */}
            {stats.map((s) => {
              const tr = s.trend;
              const up = tr ? tr.delta > 0 : false;
              const down = tr ? tr.delta < 0 : false;
              const flat = tr ? tr.delta === 0 : true;
              const TrendIcon = up ? TrendingUp : down ? TrendingDown : Minus;
              const trendColor = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
              return (
                <Card key={s.label} className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    {s.loading ? (
                      <>
                        <Skeleton className="mt-2 h-7 w-20" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </>
                    ) : (
                      <>
                        <p className="mt-1 font-display text-2xl font-semibold leading-tight">{s.value.toLocaleString("pt-BR")}</p>
                        {tr && (
                          <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
                            <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="font-medium">
                              {tr.isNew ? "novo" : flat ? "estável" : `${up ? "+" : ""}${tr.delta}%`}
                            </span>
                            <span className="truncate text-muted-foreground">vs. 7d</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="shrink-0 rounded-lg bg-accent p-2 text-accent-foreground">
                    <s.icon className="h-4 w-4" aria-hidden />
                  </div>
                </Card>
              );
            })}

            {/* Secondary tiles */}
            <Card className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Taxa de leitura</p>
                {c.isPending ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <>
                    <p className="mt-1 font-display text-2xl font-semibold leading-tight">{readRate}%</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{totals.read.toLocaleString("pt-BR")} leituras confirmadas</p>
                  </>
                )}
              </div>
              <div className="shrink-0 rounded-lg bg-accent p-2 text-accent-foreground">
                <Eye className="h-4 w-4" aria-hidden />
              </div>
            </Card>

            <Card className={`col-span-1 sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 p-4 ${totals.failed > 0 ? "border-destructive/40" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Falhas</p>
                {c.isPending ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <>
                    <p className={`mt-1 font-display text-2xl font-semibold leading-tight ${totals.failed > 0 ? "text-destructive" : ""}`}>
                      {totals.failed.toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">Verifique credenciais e templates</p>
                  </>
                )}
              </div>
              <div className={`shrink-0 rounded-lg p-2 ${totals.failed > 0 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </div>
            </Card>
          </div>
        </section>


      <div className="grid gap-3 px-4 pb-6 sm:gap-4 sm:px-6 lg:grid-cols-5">
        <Card className="p-4 sm:p-5 lg:col-span-2">

          <p className="text-xs uppercase tracking-wide text-muted-foreground">Distribuição de mensagens</p>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">Status agregado de todas as campanhas</p>
          <div className="h-64">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={STATUS_HEX[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Volume por campanha</p>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">Top {barData.length} campanhas mais recentes</p>
          <div className="h-64">
            {barData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem campanhas ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                    itemStyle={{ color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} iconType="circle" />
                  <Bar dataKey="Entregue" stackId="a" fill={STATUS_HEX.delivered} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Lida" stackId="a" fill={STATUS_HEX.read} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Falhou" stackId="a" fill={STATUS_HEX.failed} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="px-6 pb-12">
        <h2 className="mb-3 font-display text-lg font-semibold">Mensagens por status — por campanha</h2>
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <div className="col-span-3">Campanha</div>
            <div className="col-span-4">Distribuição</div>
            {STATUS_KEYS.map((k) => (
              <div key={k} className="text-right">{STATUS_LABEL[k]}</div>
            ))}
          </div>
          <div className="divide-y">
            {(c.data ?? []).map((x: any) => {
              const t = (x.totals ?? {}) as Record<string, number>;
              const total = t.total ?? STATUS_KEYS.reduce((s, k) => s + (t[k] ?? 0), 0);
              return (
                <Link
                  key={x.id}
                  to="/campaigns/$id"
                  params={{ id: x.id }}
                  className="grid grid-cols-2 gap-3 px-4 py-3 text-sm hover:bg-muted/30 md:grid-cols-12 md:items-center"
                >
                  <div className="col-span-2 md:col-span-3">
                    <p className="truncate font-medium">{x.name}</p>
                    <p className="text-xs text-muted-foreground">{x.status} · {total} total</p>
                  </div>
                  <div className="col-span-2 md:col-span-4">
                    <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
                      {STATUS_KEYS.map((k) => {
                        const v = t[k] ?? 0;
                        const pct = total > 0 ? (v / total) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={k}
                            className={STATUS_COLOR[k]}
                            style={{ width: `${pct}%` }}
                            title={`${STATUS_LABEL[k]}: ${v}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  {STATUS_KEYS.map((k) => (
                    <div key={k} className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">{STATUS_LABEL[k]}:</span>
                      <span className={k === "failed" && (t[k] ?? 0) > 0 ? "text-destructive font-medium" : ""}>
                        {t[k] ?? 0}
                      </span>
                    </div>
                  ))}
                </Link>
              );
            })}
            {(c.data ?? []).length === 0 && (
              <Empty className="border-0 py-12">
                <EmptyMedia variant="icon">
                  <Send className="h-6 w-6" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>Nenhuma campanha ainda</EmptyTitle>
                  <EmptyDescription>
                    Crie sua primeira campanha para começar a disparar mensagens via WhatsApp Cloud API.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link to="/campaigns">
                      <Plus className="h-4 w-4" />
                      Criar primeira campanha
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
          {(c.data ?? []).length > 0 && (
            <div className="flex flex-wrap gap-3 border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              {STATUS_KEYS.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-3 rounded ${STATUS_COLOR[k]}`} /> {STATUS_LABEL[k]}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}
