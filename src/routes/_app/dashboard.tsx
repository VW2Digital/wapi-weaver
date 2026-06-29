import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listContacts } from "@/lib/contacts.functions";
import { listTemplates } from "@/lib/templates.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { cn } from "@/lib/utils";
import { normalizeCampaignTotals } from "@/lib/campaign-totals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Eye,
  AlertTriangle,
  Plus,
  X,
  Bell,
  Info,
  Check,
} from "lucide-react";
import { useState, useMemo } from "react";
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
  pending: "#f59e0b", // Amber-500
  sent: "#3b82f6", // Blue-500
  delivered: "#10b981", // Emerald-500
  read: "#4f46e5", // Indigo-600
  failed: "#ef4444", // Red-500
};

const STATUS_KEYS = ["pending", "sent", "delivered", "read", "failed"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  sending: "Enviando",
  sent: "Enviada",
  sentOnly: "Enviada",
  delivered: "Entregue",
  deliveredOnly: "Entregue",
  read: "Lida",
  failed: "Falhou",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500",
  sending: "bg-sky-400",
  sent: "bg-blue-500",
  sentOnly: "bg-blue-500",
  delivered: "bg-emerald-500",
  deliveredOnly: "bg-emerald-500",
  read: "bg-indigo-600",
  failed: "bg-red-500",
};

function Dashboard() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchContacts = useServerFn(listContacts);
  const fetchTemplates = useServerFn(listTemplates);
  const fetchStats = useServerFn(getDashboardStats);

  const c = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchCampaigns() });
  const ct = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });
  const t = useQuery({ queryKey: ["templates"], queryFn: () => fetchTemplates() });
  const s = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fetchStats() });

  const totals = (c.data ?? []).reduce(
    (acc: { sent: number; delivered: number; read: number; failed: number; completed: number }, x: any) => {
      const t = normalizeCampaignTotals(x.totals);
      acc.sent += t.sent;
      acc.delivered += t.delivered;
      acc.read += t.read;
      acc.failed += t.failed;
      acc.completed += t.completed;
      return acc;
    },
    { sent: 0, delivered: 0, read: 0, failed: 0, completed: 0 },
  );

  const deliverRate = totals.completed ? Math.round((totals.delivered / totals.completed) * 100) : 0;
  const readRate = totals.delivered ? Math.round((totals.read / totals.delivered) * 100) : 0;

  const notifications = useMemo(() => {
    const list: { id: string; type: "success" | "error" | "info"; title: string; desc: string; date?: string }[] = [];

    // 1. Campaign dispatch completions
    const completedCampaigns = (c.data ?? []).filter((x: any) => x.status === "completed" || x.status === "sent");
    completedCampaigns.forEach((x: any) => {
      const t = normalizeCampaignTotals(x.totals);
      list.push({
        id: `campaign-completed-${x.id}`,
        type: "success",
        title: "Envio de Campanha Concluído",
        desc: `A campanha "${x.name}" foi concluída. ${t.delivered} entregues, ${t.failed} falhas.`,
        date: x.updated_at ? new Date(x.updated_at).toLocaleDateString("pt-BR") : undefined
      });
    });

    // 2. Failed messages alerts
    const failedCampaigns = (c.data ?? []).filter((x: any) => {
      const t = normalizeCampaignTotals(x.totals);
      return t.failed > 0;
    });
    failedCampaigns.forEach((x: any) => {
      const t = normalizeCampaignTotals(x.totals);
      list.push({
        id: `campaign-failed-${x.id}`,
        type: "error",
        title: "Mensagens com Falha",
        desc: `A campanha "${x.name}" registrou ${t.failed} falhas de envio.`,
        date: x.updated_at ? new Date(x.updated_at).toLocaleDateString("pt-BR") : undefined
      });
    });

    // 3. New conversations (unread messages)
    const unreadCount = (ct.data ?? []).filter((x: any) => x.is_unread || (x.unread_count ?? 0) > 0).length;
    if (unreadCount > 0) {
      list.push({
        id: "new-chats-unread",
        type: "info",
        title: "Novas Conversas",
        desc: `Você possui ${unreadCount} ${unreadCount === 1 ? "conversa" : "conversas"} com novas mensagens não lidas.`,
      });
    }

    return list;
  }, [c.data, ct.data]);

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

  const barData = (c.data ?? []).slice(0, 8).map((x: any) => {
    const t = normalizeCampaignTotals(x.totals);
    const name = String(x.name ?? "—");
    const sentOnly = t.sent - t.delivered;
    const deliveredOnly = t.delivered - t.read;
    return {
      name: name.length > 14 ? name.slice(0, 14) + "…" : name,
      Enviada: sentOnly,
      Entregue: deliveredOnly,
      Lida: t.read,
      Falhou: t.failed,
    };
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header com o Título e o Sino de Notificações */}
      <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6 shrink-0 bg-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border bg-background hover:bg-muted">
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                  {notifications.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[320px] max-h-[400px] overflow-y-auto" align="end">
            <DropdownMenuLabel className="text-xs font-semibold">Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Nenhuma notificação recente.
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = n.type === "success" ? CheckCircle2 : n.type === "error" ? AlertTriangle : Info;
                const iconColor = n.type === "success" ? "text-success" : n.type === "error" ? "text-destructive" : "text-primary";
                return (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start p-3 focus:bg-muted/50 cursor-pointer gap-1">
                    <div className="flex w-full items-start gap-2">
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", iconColor)} />
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-semibold leading-none">{n.title}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{n.desc}</p>
                        {n.date && (
                          <p className="text-[9px] text-muted-foreground/60">{n.date}</p>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(() => {
          if (c.isPending) return null;
          const failureRate = totals.completed ? Math.round((totals.failed / totals.completed) * 100) : 0;
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
          if (totals.completed >= 20 && deliverRate < 70) {
            alerts.push({
              title: `Taxa de entrega baixa: ${deliverRate}%`,
              description: "Abaixo de 70%. Revise a qualidade dos números e o template usado.",
            });
          }
          if (alerts.length === 0) return null;
          return (
            <div className="space-y-2 px-4 pt-4 sm:px-6 sm:pt-6">
              {alerts
                .filter((a) => !dismissedAlerts.includes(a.title))
                .map((a) => (
                  <Alert key={a.title} variant="destructive" className="relative pr-10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{a.title}</AlertTitle>
                    <AlertDescription>{a.description}</AlertDescription>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDismissedAlerts((prev) => [...prev, a.title])}
                      aria-label="Fechar aviso"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Alert>
                ))}
            </div>
          );
        })()}

        <section aria-labelledby="bento-heading" className="p-4 sm:p-6">
          <h2 id="bento-heading" className="sr-only">
            Visão geral
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 lg:grid-cols-6 lg:auto-rows-[7rem]">
            {/* Hero tile — Taxa de entrega (bento highlight) */}
            <Card className="col-span-2 sm:col-span-4 lg:col-span-3 lg:row-span-2 relative overflow-hidden p-5 sm:p-6 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
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
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Taxa de entrega
                    </p>
                    {c.isPending ? (
                      <Skeleton className="mt-2 h-10 w-32" />
                    ) : (
                      <p className="mt-1 font-display text-4xl font-semibold leading-none sm:text-5xl">
                        {deliverRate}
                        <span className="ml-1 text-2xl text-muted-foreground sm:text-3xl">%</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {totals.delivered.toLocaleString("pt-BR")} de{" "}
                      {totals.completed.toLocaleString("pt-BR")} mensagens entregues
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
              const trendColor = up
                ? "text-success"
                : down
                  ? "text-destructive"
                  : "text-muted-foreground";
              return (
                <Card
                  key={s.label}
                  className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-row items-center justify-between gap-3 p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                    {s.loading ? (
                      <>
                        <Skeleton className="mt-2 h-7 w-20" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </>
                    ) : (
                      <>
                        <p className="mt-1 font-display text-2xl font-semibold leading-tight">
                          {s.value.toLocaleString("pt-BR")}
                        </p>
                        {tr && (
                          <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
                            <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="font-medium">
                              {tr.isNew
                                ? "novo"
                                : flat
                                  ? "estável"
                                  : `${up ? "+" : ""}${tr.delta}%`}
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
            <Card className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-row items-center justify-between gap-3 p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Taxa de leitura
                </p>
                {c.isPending ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <>
                    <p className="mt-1 font-display text-2xl font-semibold leading-tight">
                      {readRate}%
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {totals.read.toLocaleString("pt-BR")} leituras confirmadas
                    </p>
                  </>
                )}
              </div>
              <div className="shrink-0 rounded-lg bg-accent p-2 text-accent-foreground">
                <Eye className="h-4 w-4" aria-hidden />
              </div>
            </Card>

            <Card
              className={cn(
                "col-span-1 sm:col-span-2 lg:col-span-3 flex flex-row items-center justify-between gap-3 p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
                totals.failed > 0 ? "border-destructive/40" : "",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Falhas
                </p>
                {c.isPending ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <>
                    <p
                      className={`mt-1 font-display text-2xl font-semibold leading-tight ${totals.failed > 0 ? "text-destructive" : ""}`}
                    >
                      {totals.failed.toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Verifique credenciais e templates
                    </p>
                  </>
                )}
              </div>
              <div
                className={`shrink-0 rounded-lg p-2 ${totals.failed > 0 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </div>
            </Card>
          </div>
        </section>

        <div className="grid gap-3 px-4 pb-6 sm:gap-4 sm:px-6 lg:grid-cols-5">
          <Card className="p-4 sm:p-5 lg:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Distribuição de mensagens
            </p>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              Status agregado de todas as campanhas
            </p>
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

          <Card className="p-4 sm:p-5 lg:col-span-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Volume por campanha
            </p>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              Top {barData.length} campanhas mais recentes
            </p>
            <div className="h-64">
              {barData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Sem campanhas ainda
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="currentColor"
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
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
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="Enviada"
                      stackId="a"
                      fill={STATUS_HEX.sent}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="Entregue"
                      stackId="a"
                      fill={STATUS_HEX.delivered}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar dataKey="Lida" stackId="a" fill={STATUS_HEX.read} radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="Falhou"
                      stackId="a"
                      fill={STATUS_HEX.failed}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        <div className="px-4 pb-12 sm:px-6">
          <h2 className="mb-3 font-display text-base font-semibold sm:text-lg">
            Mensagens por status — por campanha
          </h2>

          <Card className="overflow-hidden">
            <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <div className="col-span-3">Campanha</div>
              <div className="col-span-4">Distribuição</div>
              {STATUS_KEYS.map((k) => (
                <div key={k} className="text-right">
                  {STATUS_LABEL[k]}
                </div>
              ))}
            </div>
            <div className="divide-y">
              {(c.data ?? []).map((x: any) => {
                const n = normalizeCampaignTotals(x.totals);
                const total = n.total;
                const distBar: Record<string, number> = {
                  pending: n.pending,
                  sending: n.sending,
                  sentOnly: n.sent - n.delivered,
                  deliveredOnly: n.delivered - n.read,
                  read: n.read,
                  failed: n.failed,
                };
                const distKeys = ["pending", "sending", "sentOnly", "deliveredOnly", "read", "failed"];
                return (
                  <Link
                    key={x.id}
                    to="/campaigns/$id"
                    params={{ id: x.id }}
                    className="grid grid-cols-2 gap-3 px-4 py-3 text-sm hover:bg-muted/30 md:grid-cols-12 md:items-center"
                  >
                    <div className="col-span-2 md:col-span-3">
                      <p className="truncate font-medium">{x.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.status} · {total} total
                      </p>
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <div className="flex h-2 w-full overflow-hidden rounded bg-muted">
                        {distKeys.map((k) => {
                          const v = distBar[k] ?? 0;
                          const pct = total > 0 ? (v / total) * 100 : 0;
                          if (pct === 0) return null;
                          return (
                            <div
                              key={k}
                              className={STATUS_COLOR[k] || "bg-muted-foreground"}
                              style={{ width: `${pct}%` }}
                              title={`${STATUS_LABEL[k] || k}: ${v}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Pendente:</span>
                      {n.pending}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Enviada:</span>
                      {n.sent}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Entregue:</span>
                      {n.delivered}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Lida:</span>
                      {n.read}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Falhou:</span>
                      <span className={n.failed > 0 ? "text-destructive font-medium" : ""}>
                        {n.failed}
                      </span>
                    </div>
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
                      Crie sua primeira campanha para começar a disparar mensagens via WhatsApp
                      Cloud API.
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
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-amber-500" /> Pendente
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-sky-400" /> Enviando
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-blue-500" /> Enviada
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-emerald-500" /> Entregue
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-indigo-600" /> Lida
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded bg-red-500" /> Falhou
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
