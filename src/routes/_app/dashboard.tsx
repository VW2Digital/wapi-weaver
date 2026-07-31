import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listTemplates } from "@/lib/templates.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { getLicenseStatus } from "@/lib/admin.functions";
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
import { usePageHeader } from "@/components/layout/page-header-provider";
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
  MessageCircle,
  Clock,
  CheckCheck,
  UserPlus,
  Activity,
  Timer,
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
  pending: "#F26A4B", // Brand Color 4
  sent: "#BF39B6", // Brand Color 3
  delivered: "#D93B92", // Brand Color 2
  read: "#F23869", // Brand Color 1
  failed: "#F23869", // Brand Color 1
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
  pending: "bg-[#F26A4B]",
  sending: "bg-[#BF39B6]",
  sent: "bg-[#BF39B6]",
  sentOnly: "bg-[#BF39B6]",
  delivered: "bg-[#D93B92]",
  deliveredOnly: "bg-[#D93B92]",
  read: "bg-[#F23869]",
  failed: "bg-[#F23869]",
};

function Dashboard() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchTemplates = useServerFn(listTemplates);
  const fetchStats = useServerFn(getDashboardStats);
  const fetchLicenseStatus = useServerFn(getLicenseStatus);

  const c = useQuery({ 
    queryKey: ["campaigns"], 
    queryFn: () => fetchCampaigns(),
    staleTime: 5000 
  });
  const t = useQuery({ 
    queryKey: ["templates"], 
    queryFn: () => fetchTemplates(),
    staleTime: 60000 
  });
  const s = useQuery({ 
    queryKey: ["dashboard-stats"], 
    queryFn: () => fetchStats(),
    staleTime: 15000 
  });
  const lic = useQuery({ 
    queryKey: ["license-status"], 
    queryFn: () => fetchLicenseStatus(),
    staleTime: 300000 
  });
  const isLicenseValid = true;

  const totals = (c.data ?? []).reduce(
    (
      acc: { sent: number; delivered: number; read: number; failed: number; completed: number },
      x: any,
    ) => {
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

  const deliverRate = totals.completed
    ? Math.round((totals.delivered / totals.completed) * 100)
    : 0;
  const readRate = totals.delivered ? Math.round((totals.read / totals.delivered) * 100) : 0;

  const notifications = useMemo(() => {
    const list: {
      id: string;
      type: "success" | "error" | "info";
      title: string;
      desc: string;
      date?: string;
    }[] = [];

    // 1. Campaign dispatch completions
    const completedCampaigns = (c.data ?? []).filter((x: any) => x.status === "done");
    completedCampaigns.forEach((x: any) => {
      const t = normalizeCampaignTotals(x.totals);
      list.push({
        id: `campaign-completed-${x.id}`,
        type: "success",
        title: "Envio de Campanha Concluído",
        desc: `A campanha "${x.name}" foi concluída. ${t.delivered} entregues, ${t.failed} falhas.`,
        date: x.updated_at ? new Date(x.updated_at).toLocaleDateString("pt-BR") : undefined,
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
        date: x.updated_at ? new Date(x.updated_at).toLocaleDateString("pt-BR") : undefined,
      });
    });

    // 3. New conversations (unread messages)
    const unreadCount = s.data?.chatMetrics?.unreadChatsCount ?? 0;
    if (unreadCount > 0) {
      list.push({
        id: "new-chats-unread",
        type: "info",
        title: "Novas Conversas",
        desc: `Você possui ${unreadCount} ${unreadCount === 1 ? "conversa" : "conversas"} com novas mensagens não lidas.`,
      });
    }

    return list;
  }, [c.data, s.data]);

  usePageHeader({
    title: "Dashboard",
    action: (
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full border bg-background hover:bg-muted"
        >
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
            const Icon =
              n.type === "success" ? CheckCircle2 : n.type === "error" ? AlertTriangle : Info;
            const iconColor =
              n.type === "success"
                ? "text-success"
                : n.type === "error"
                  ? "text-destructive"
                  : "text-primary";
            return (
              <DropdownMenuItem
                key={n.id}
                className="flex flex-col items-start p-3 focus:bg-muted/50 cursor-pointer gap-1"
              >
                <div className="flex w-full items-start gap-2">
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", iconColor)} />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold leading-none">{n.title}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {n.desc}
                    </p>
                    {n.date && <p className="text-[9px] text-muted-foreground/60">{n.date}</p>}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    ),
  });

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
      value: s.data?.contacts.current ?? 0,
      icon: Users,
      trend: s.data ? trend(s.data.contacts.current, s.data.contacts.previous) : null,
      loading: s.isPending,
    },
    {
      label: "Templates",
      value: t.data?.length ?? s.data?.templates.current ?? 0,
      icon: FileText,
      trend: s.data ? trend(s.data.templates.current, s.data.templates.previous) : null,
      loading: t.isPending || s.isPending,
    },
    {
      label: "Campanhas",
      value: c.data?.length ?? s.data?.campaigns.current ?? 0,
      icon: Send,
      trend: s.data ? trend(s.data.campaigns.current, s.data.campaigns.previous) : null,
      loading: c.isPending || s.isPending,
    },
    {
      label: "Entregas (7d)",
      value: s.data?.delivered.current ?? totals.delivered,
      icon: CheckCircle2,
      trend: s.data ? trend(s.data.delivered.current, s.data.delivered.previous) : null,
      loading: s.isPending,
    },
  ];

  const chatMetrics = s.data?.chatMetrics || {
    emConversa: 0,
    aguardando: 0,
    finalizados: 0,
    novosContatos: 0,
    tmConversa: "00h 00m",
    tmEspera: "00h 00m",
  };

  const chatStats = [
    { label: "Em Conversa", value: chatMetrics.emConversa, icon: MessageCircle },
    { label: "Aguardando", value: chatMetrics.aguardando, icon: Clock },
    { label: "Finalizados", value: chatMetrics.finalizados, icon: CheckCheck },
    { label: "Novos Contatos", value: chatMetrics.novosContatos, icon: UserPlus },
    { label: "T.M. de Conversa", value: chatMetrics.tmConversa, icon: Activity },
    { label: "T.M. de Espera", value: chatMetrics.tmEspera, icon: Timer },
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


      <div className="flex-1 overflow-y-auto">
        {!isLicenseValid && (
          <div className="px-4 pt-4 sm:px-6">
            {(() => {
              const graceDaysRemaining = Number(lic.data?.graceDaysRemaining ?? 3);
              return (
                <Alert
                  variant="destructive"
                  className="border-destructive/35 bg-destructive/5 text-destructive flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <AlertTitle className="font-semibold text-sm">
                        {lic.data?.isAccessAllowed === false
                          ? "Acesso Bloqueado — Licença Expirada ou Ausente"
                          : "Licença Inválida ou Expirada"}
                      </AlertTitle>
                      <AlertDescription className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {lic.data?.isAccessAllowed === false
                          ? "Sua instalação está sem uma licença ativa válida e o envio de mensagens foi suspenso. Por favor, regularize sua licença com o suporte para restabelecer o serviço imediatamente."
                          : `Sua instalação está sem uma licença ativa válida. Evite o bloqueio do envio de mensagens em até ${graceDaysRemaining} ${graceDaysRemaining === 1 ? "dia" : "dias"}. Entre em contato com o suporte.`}
                      </AlertDescription>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="shrink-0 bg-[#25D366] hover:bg-[#1ebd56] text-white font-semibold gap-2 border-none shadow-sm transition-colors duration-200"
                  >
                    <a
                      href="https://wa.me/5591936180534?text=Ol%C3%A1%2C%20gostaria%20de%20regularizar%20a%20minha%20licen%C3%A7a%20do%20sistema."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="currentColor"
                        className="shrink-0"
                      >
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.623-1.023-5.086-2.885-6.948C16.59 2.016 14.133.997 11.512.997 6.079.997 1.656 5.369 1.65 10.799c-.001 1.7.453 3.36 1.317 4.81l-.994 3.63 3.734-.974.36.214zM17.306 14.37c-.327-.164-1.938-.957-2.244-1.069-.306-.113-.528-.169-.749.162-.222.33-.86 1.069-1.055 1.293-.195.223-.39.248-.717.084a9.043 9.043 0 0 1-2.66-1.636 9.97 9.97 0 0 1-1.842-2.292c-.193-.328-.02-.505.143-.668.147-.146.327-.38.49-.57.164-.189.219-.324.327-.54.109-.217.055-.407-.027-.571-.082-.164-.75-1.809-1.028-2.48-.27-.65-.564-.56-.75-.56h-.638c-.222 0-.584.083-.89.416-.306.33-1.169 1.142-1.169 2.782 0 1.64 1.196 3.22 1.358 3.44.163.22 2.353 3.591 5.698 5.037.796.344 1.418.549 1.904.704.8.254 1.528.218 2.102.132.64-.096 1.938-.793 2.21-1.558.272-.765.272-1.422.19-1.557-.08-.134-.306-.217-.638-.38z" />
                      </svg>
                      Falar com o Suporte
                    </a>
                  </Button>
                </Alert>
              );
            })()}
          </div>
        )}

        <section aria-labelledby="chat-metrics" className="p-4 sm:p-6 pb-0">
          <h2 id="chat-metrics" className="sr-only">
            Métricas de Atendimento
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {chatStats.map((sItem, i) => (
              <Card
                key={i}
                className="flex flex-col gap-2 p-4 min-h-[96px] justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <sItem.icon className="h-4 w-4" aria-hidden />
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider">
                    {sItem.label}
                  </p>
                </div>
                {s.isPending ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="font-display text-2xl font-bold leading-tight text-foreground">
                    {sItem.value}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 px-4 pb-6 sm:px-6">
          {/* Performance de Entrega */}
          <Card className="lg:col-span-2 p-5 sm:p-6 bg-card border shadow-sm flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="font-display text-sm font-bold tracking-wider text-muted-foreground/80 uppercase">
                PERFORMANCE DE ENTREGA
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Entrega vs. leitura</p>
            </div>

            <div className="flex items-center justify-around py-4 flex-1">
              {/* Taxa de entrega */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-28 w-28 flex items-center justify-center">
                  {s.isPending || c.isPending ? (
                    <Skeleton className="h-28 w-28 rounded-full" />
                  ) : (
                    <>
                      <svg
                        className="absolute transform -rotate-90 w-full h-full"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          className="stroke-muted/30"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          stroke="#FF7043"
                          strokeWidth="8"
                          strokeDasharray={226.2}
                          strokeDashoffset={226.2 - (deliverRate / 100) * 226.2}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-500 ease-out"
                        />
                      </svg>
                      <span className="font-display text-2xl font-bold text-foreground">
                        {deliverRate}%
                      </span>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-medium">Taxa de entrega</span>
              </div>

              {/* Taxa de leitura */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative h-28 w-28 flex items-center justify-center">
                  {s.isPending || c.isPending ? (
                    <Skeleton className="h-28 w-28 rounded-full" />
                  ) : (
                    <>
                      <svg
                        className="absolute transform -rotate-90 w-full h-full"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          className="stroke-muted/30"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          stroke="#FBBF24"
                          strokeWidth="8"
                          strokeDasharray={226.2}
                          strokeDashoffset={226.2 - (readRate / 100) * 226.2}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-500 ease-out"
                        />
                      </svg>
                      <span className="font-display text-2xl font-bold text-foreground">
                        {readRate}%
                      </span>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-medium">Taxa de leitura</span>
              </div>
            </div>
          </Card>

          {/* Atividade Geral */}
          <Card className="lg:col-span-3 p-5 sm:p-6 bg-card border shadow-sm flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="font-display text-sm font-bold tracking-wider text-muted-foreground/80 uppercase">
                ATIVIDADE GERAL
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Contatos · templates · campanhas · entregas · falhas
              </p>
            </div>

            <div className="mt-6 space-y-4 w-full">
              {[
                { label: "Contatos", value: s.data?.contacts.current ?? 0, pending: s.isPending },
                { label: "Templates", value: t.data?.length ?? s.data?.templates.current ?? 0, pending: t.isPending || s.isPending },
                { label: "Campanhas", value: c.data?.length ?? s.data?.campaigns.current ?? 0, pending: c.isPending || s.isPending },
                { label: "Entregas (7d)", value: s.data?.delivered.current ?? totals.delivered, pending: s.isPending },
                { label: "Falhas", value: totals.failed, pending: c.isPending },
              ].map((item, idx) => {
                const totalContacts = s.data?.contacts.current ?? 0;
                const totalTemplates = t.data?.length ?? s.data?.templates.current ?? 0;
                const totalCampaigns = c.data?.length ?? s.data?.campaigns.current ?? 0;
                const totalDelivered = s.data?.delivered.current ?? totals.delivered;
                const totalFailed = totals.failed;
                const maxVal = Math.max(
                  totalContacts,
                  totalTemplates,
                  totalCampaigns,
                  totalDelivered,
                  totalFailed,
                  1,
                );

                const pct = (item.value / maxVal) * 100;
                const widthStyle = item.value > 0 ? `${Math.max(pct, 1.5)}%` : "0.5%";
                return (
                  <div key={idx} className="flex items-center">
                    {/* Label */}
                    <div className="w-20 sm:w-24 text-right text-xs font-medium text-muted-foreground pr-3 shrink-0">
                      {item.label}
                    </div>
                    {/* Bar container */}
                    <div className="flex-1 h-6 bg-muted/40 rounded-md overflow-hidden relative">
                      {item.pending ? (
                        <Skeleton className="h-full w-1/3 rounded-md" />
                      ) : (
                        <div
                          className="h-full bg-primary rounded-md transition-all duration-500 ease-out"
                          style={{ width: widthStyle }}
                        />
                      )}
                    </div>
                    {/* Value */}
                    <div className="w-14 text-left text-xs font-mono text-muted-foreground pl-3 shrink-0 font-medium">
                      {item.pending ? (
                        <Skeleton className="h-4 w-8" />
                      ) : (
                        item.value.toLocaleString("pt-BR")
                      )}
                    </div>
                  </div>
                );
              })}
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
              {c.isPending ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-3 px-4 py-4 md:items-center">
                    <div className="col-span-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <div className="col-span-4">
                      <Skeleton className="h-2 w-full" />
                    </div>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="text-right md:col-span-1">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </div>
                    ))}
                  </div>
                ))
              ) : (c.data ?? []).map((x: any) => {
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
                const distKeys = [
                  "pending",
                  "sending",
                  "sentOnly",
                  "deliveredOnly",
                  "read",
                  "failed",
                ];
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
                      <span className="md:hidden text-xs text-muted-foreground mr-1">
                        Pendente:
                      </span>
                      {n.pending}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Enviada:</span>
                      {n.sent}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">
                        Entregue:
                      </span>
                      {n.delivered}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Lida:</span>
                      {n.read}
                    </div>
                    <div className="text-right text-sm tabular-nums md:col-span-1">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Falhou:</span>
                      <span className={n.failed > 0 ? "text-[#F23869] font-medium" : ""}>
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
