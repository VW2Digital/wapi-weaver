import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listAllTemplates } from "@/lib/templates.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { getLicenseStatus, getMyPlan } from "@/lib/admin.functions";
import { listContacts } from "@/lib/contacts.functions";
import { GlobalPromoBanner } from "@/components/global-promo-banner";
import { cn } from "@/lib/utils";
import { normalizeCampaignTotals } from "@/lib/campaign-totals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Crown,
  CalendarDays,
  Webhook,
  User,
  ChevronRight,
  MoreHorizontal,
  CalendarClock,
  Search,
  Filter,
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
  pending: "#f59e0b", // amber-500
  sending: "#38bdf8", // sky-400
  sent: "#3b82f6", // blue-500
  sentOnly: "#3b82f6", // blue-500
  delivered: "#10b981", // emerald-500
  deliveredOnly: "#10b981", // emerald-500
  read: "#4f46e5", // indigo-600
  failed: "#ef4444", // red-500
};

const STATUS_KEYS = ["pending", "sending", "sent", "delivered", "read", "failed"] as const;
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

function getAvatarColor(name: string): string {
  const hash = (name || "")
    .split("")
    .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 65%, 38%)`;
}

function Dashboard() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchTemplates = useServerFn(listAllTemplates);
  const fetchStats = useServerFn(getDashboardStats);
  const fetchLicenseStatus = useServerFn(getLicenseStatus);
  const fetchMyPlan = useServerFn(getMyPlan);
  const fetchContacts = useServerFn(listContacts);

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
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "7d" | "30d">("7d");
  const s = useQuery({ 
    queryKey: ["dashboard-stats", selectedPeriod], 
    queryFn: () => fetchStats({ data: { period: selectedPeriod } }),
    staleTime: 15000 
  });
  const lic = useQuery({ 
    queryKey: ["license-status"], 
    queryFn: () => fetchLicenseStatus(),
    staleTime: 300000 
  });
  const planQuery = useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fetchMyPlan(),
    staleTime: 300000,
  });
  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetchContacts(),
    staleTime: 15000,
  });
  const isLicenseValid = true;

  const [searchQuery, setSearchQuery] = useState("");

  const filteredCampaigns = useMemo(() => {
    if (!c.data) return [];
    if (!searchQuery.trim()) return c.data;
    const q = searchQuery.toLowerCase();
    return c.data.filter((camp: any) => camp.name?.toLowerCase().includes(q));
  }, [c.data, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!contactsQuery.data) return [];
    if (!searchQuery.trim()) return contactsQuery.data;
    const q = searchQuery.toLowerCase();
    return contactsQuery.data.filter((contact: any) => 
      contact.name?.toLowerCase().includes(q) || 
      contact.email?.toLowerCase().includes(q) ||
      contact.phone?.includes(q) ||
      contact.phone_e164?.includes(q) ||
      contact.company?.toLowerCase().includes(q)
    );
  }, [contactsQuery.data, searchQuery]);

  const latestUpdatedTimestamp = Math.max(c.dataUpdatedAt || 0, contactsQuery.dataUpdatedAt || 0, s.dataUpdatedAt || 0);
  const latestUpdatedDate = latestUpdatedTimestamp > 0 
    ? new Date(latestUpdatedTimestamp)
    : new Date();
  
  const formattedLatestUpdated = latestUpdatedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const totals = filteredCampaigns.reduce(
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

  const successfulCampaignDeliveries = totals.delivered > 0 ? totals.delivered : (totals.sent > 0 ? totals.sent : 0);
  const totalCompletedCampaigns = totals.completed > 0 ? totals.completed : (totals.sent + totals.failed);
  const deliverRate = totalCompletedCampaigns > 0
    ? Math.round((successfulCampaignDeliveries / totalCompletedCampaigns) * 100)
    : (s.data?.delivered.current && s.data.delivered.current > 0 ? 100 : 0);
  const readRate = successfulCampaignDeliveries > 0
    ? Math.round((totals.read / successfulCampaignDeliveries) * 100)
    : 0;

  const notifications = useMemo(() => {
    const list: {
      id: string;
      type: "success" | "error" | "info";
      title: string;
      desc: string;
      date?: string;
    }[] = [];

    // 1. Campaign dispatch completions
    const completedCampaigns = filteredCampaigns.filter((x: any) => x.status === "done");
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
    const failedCampaigns = filteredCampaigns.filter((x: any) => {
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
      <div className="flex items-center gap-2">
        {/* Plan Badge */}
        {planQuery.data && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              planQuery.data.status === "active"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
            title={
              planQuery.data.expires_at
                ? `Vence em ${new Date(planQuery.data.expires_at).toLocaleDateString("pt-BR")}`
                : undefined
            }
          >
            <Crown className="h-3 w-3" />
            <span>{planQuery.data.plan_name ?? "Sem plano"}</span>
            {planQuery.data.expires_at && (
              <span className="flex items-center gap-0.5 opacity-70">
                <CalendarDays className="h-2.5 w-2.5" />
                {new Date(planQuery.data.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {/* Notifications bell */}
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
      </div>
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

  const contactStatusCounts = useMemo(() => {
    const list = searchQuery.trim() ? filteredContacts : contactsQuery.data;
    if (!list) return null;
    let aberto = 0;
    let aguardando = 0;
    let fechado = 0;
    for (const contact of list) {
      const st = String(contact.chat_status || "aberto").toLowerCase();
      if (st === "aguardando" || st === "pendente") {
        aguardando++;
      } else if (st === "fechado") {
        fechado++;
      } else {
        aberto++;
      }
    }
    return { aberto, aguardando, fechado };
  }, [contactsQuery.data, filteredContacts, searchQuery]);

  const emConversaCount = contactStatusCounts ? contactStatusCounts.aberto : (s.data?.chatMetrics?.emConversa ?? 0);
  const aguardandoCount = contactStatusCounts ? contactStatusCounts.aguardando : (s.data?.chatMetrics?.aguardando ?? 0);
  const finalizadosCount = contactStatusCounts ? contactStatusCounts.fechado : (s.data?.chatMetrics?.finalizados ?? 0);

  const novosContatosCount = useMemo(() => {
    const list = searchQuery.trim() ? filteredContacts : contactsQuery.data;
    if (list) {
      const now = Date.now();
      const ms = selectedPeriod === "today"
        ? 24 * 60 * 60 * 1000
        : selectedPeriod === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
      const cutoff = now - ms;
      return list.filter((c: any) => c.created_at && new Date(c.created_at).getTime() >= cutoff).length;
    }
    return s.data?.chatMetrics?.novosContatos ?? 0;
  }, [contactsQuery.data, filteredContacts, searchQuery, selectedPeriod, s.data]);

  const chatMetrics = s.data?.chatMetrics || {
    emConversa: emConversaCount,
    aguardando: aguardandoCount,
    finalizados: finalizadosCount,
    novosContatos: novosContatosCount,
    tmConversa: "00h 00m",
    tmEspera: "00h 00m",
  };

  const chatStats = [
    { label: "Em Conversa", value: emConversaCount, icon: MessageCircle },
    { label: "Aguardando", value: aguardandoCount, icon: Clock },
    { label: "Finalizados", value: finalizadosCount, icon: CheckCheck },
    { label: "Novos Contatos", value: novosContatosCount, icon: UserPlus },
    { label: "T.M. de Conversa", value: chatMetrics.tmConversa, icon: Activity },
    { label: "T.M. de Espera", value: chatMetrics.tmEspera, icon: Timer },
  ];

  const pieData = [
    { key: "delivered", name: "Entregue", value: totals.delivered },
    { key: "read", name: "Lida", value: totals.read },
    { key: "sent", name: "Enviada", value: Math.max(totals.sent - totals.delivered, 0) },
    { key: "failed", name: "Falhou", value: totals.failed },
  ].filter((d) => d.value > 0);

  const barData = filteredCampaigns.slice(0, 8).map((x: any) => {
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

        {/* Filter Bar */}
        <div className="px-4 pt-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left side: Latest updated */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md bg-card text-xs text-muted-foreground shadow-xs whitespace-nowrap shrink-0">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <span>Última atualização: <span className="text-foreground font-semibold">{formattedLatestUpdated}</span></span>
            </div>

            {/* Right side: Search and Period Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-card shadow-xs text-xs"
                />
              </div>
              <Select value={selectedPeriod} onValueChange={(val: any) => setSelectedPeriod(val)}>
                <SelectTrigger className="h-9 w-[160px] bg-card text-xs font-medium rounded-md shadow-xs shrink-0 cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="today" className="text-xs">Hoje</SelectItem>
                  <SelectItem value="7d" className="text-xs">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d" className="text-xs">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6 pb-12 space-y-4 sm:space-y-6">
          {/* ========================================================= */}
          {/* TOP SECTION: 4 Columns (KPIs + Leads Recentes)             */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {/* Coluna 1: CONTATOS (Hero Card) + AGUARDANDO */}
            <div className="flex flex-col gap-4">
              {/* CONTATOS */}
              <Card className="flex-[2] bg-gradient-to-br from-[#F23869] to-[#D93B92] text-white p-5 rounded-2xl border-0 shadow-md flex flex-col justify-between min-h-[145px]">
                <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                  CONTATOS
                </span>
                <span className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-4">
                  {s.isPending && contactsQuery.isPending ? (
                    <Skeleton className="h-10 w-24 bg-white/20" />
                  ) : (
                    ((contactsQuery.data && contactsQuery.data.length > 0) ? (searchQuery.trim() ? filteredContacts.length : contactsQuery.data.length) : (s.data?.contacts.current ?? 0)).toLocaleString("pt-BR")
                  )}
                </span>
              </Card>

              {/* AGUARDANDO */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  AGUARDANDO
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {s.isPending && contactsQuery.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    aguardandoCount.toLocaleString("pt-BR")
                  )}
                </span>
              </Card>
            </div>

            {/* Coluna 2: TEMPLATES + ENTREGAS (7D) + FINALIZADOS */}
            <div className="flex flex-col gap-4">
              {/* TEMPLATES */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  TEMPLATES
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {t.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    t.data?.length ?? s.data?.templates.current ?? 0
                  )}
                </span>
              </Card>

              {/* ENTREGAS */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {selectedPeriod === "today" ? "ENTREGAS (HOJE)" : selectedPeriod === "30d" ? "ENTREGAS (30D)" : "ENTREGAS (7D)"}
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {s.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    (s.data?.delivered.current ?? 0) > 0
                      ? (s.data?.delivered.current ?? 0).toLocaleString("pt-BR")
                      : totals.delivered > 0
                        ? totals.delivered.toLocaleString("pt-BR")
                        : totals.sent.toLocaleString("pt-BR")
                  )}
                </span>
              </Card>

              {/* FINALIZADOS */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  FINALIZADOS
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {s.isPending && contactsQuery.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    finalizadosCount.toLocaleString("pt-BR")
                  )}
                </span>
              </Card>
            </div>

            {/* Coluna 3: CAMPANHAS + EM CONVERSA + NOVOS CONTATOS */}
            <div className="flex flex-col gap-4">
              {/* CAMPANHAS */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  CAMPANHAS
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {c.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    (searchQuery.trim() ? filteredCampaigns.length : (c.data?.length ?? s.data?.campaigns.current ?? 0)).toLocaleString("pt-BR")
                  )}
                </span>
              </Card>

              {/* EM CONVERSA */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  EM CONVERSA
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {s.isPending && contactsQuery.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    emConversaCount.toLocaleString("pt-BR")
                  )}
                </span>
              </Card>

              {/* NOVOS CONTATOS */}
              <Card className="flex-1 p-4 rounded-2xl border bg-card shadow-xs flex flex-col justify-between min-h-[75px]">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  NOVOS CONTATOS
                </span>
                <span className="font-display text-2xl font-bold text-foreground mt-1">
                  {s.isPending && contactsQuery.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    novosContatosCount.toLocaleString("pt-BR")
                  )}
                </span>
              </Card>
            </div>

            {/* Coluna 4: LEADS RECENTES */}
            <Card className="p-5 rounded-2xl border bg-card shadow-xs flex flex-col justify-between h-full min-h-[260px]">
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90">
                    LEADS RECENTES
                  </span>
                  <Link to="/contacts" className="text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-3 pt-1">
                  {contactsQuery.isPending ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    ))
                  ) : filteredContacts.slice(0, 4).map((contact: any) => {
                    const customFields =
                      contact.custom_fields && typeof contact.custom_fields === "object"
                        ? (contact.custom_fields as any)
                        : {};
                    const contactAvatar =
                      contact.avatar_url ||
                      customFields.avatar_url ||
                      customFields.photo_url ||
                      customFields.photo ||
                      customFields.picture ||
                      customFields.image_url ||
                      customFields.image;
                    const emailAvatarUrl = contact.email
                      ? `https://unavatar.io/${contact.email}?fallback=false`
                      : null;
                    const finalAvatar = contactAvatar || emailAvatarUrl;
                    const contactName = contact.name || "Sem nome";
                    const initials = (contact.name || contact.phone_e164 || "C")
                      .replace(/^\+/, "")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <Link
                        key={contact.id}
                        to="/contacts/$id"
                        params={{ id: contact.id }}
                        className="flex items-center gap-3 py-1 group hover:opacity-80 transition-opacity"
                      >
                        <Avatar className="h-6 w-6 rounded-full shrink-0 overflow-hidden ring-1 ring-border/40">
                          {finalAvatar && (
                            <AvatarImage
                              src={finalAvatar}
                              alt={contactName}
                              className="h-full w-full object-cover"
                            />
                          )}
                          <AvatarFallback
                            className="text-[9px] font-bold text-white flex items-center justify-center"
                            style={{ backgroundColor: getAvatarColor(contactName) }}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground truncate">
                          {contactName}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 text-center mt-2">
                <Link to="/contacts" className="text-xs font-medium text-sky-500 hover:underline">
                  Ver lista completa
                </Link>
              </div>
            </Card>
          </div>

          {/* ========================================================= */}
          {/* MIDDLE SECTION: Performance de Entrega + Atividade Geral  */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Performance de Entrega (Esquerda) */}
            <Card className="lg:col-span-5 p-5 sm:p-6 bg-card border shadow-xs rounded-2xl flex flex-col justify-between min-h-[220px]">
              <div>
                <h3 className="font-display text-xs font-bold tracking-wider text-muted-foreground/90 uppercase">
                  PERFORMANCE DE ENTREGA
                </h3>
              </div>

              <div className="flex items-center justify-around py-2 flex-1">
                {/* Taxa de entrega */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative h-24 w-24 flex items-center justify-center">
                    {s.isPending || c.isPending ? (
                      <Skeleton className="h-24 w-24 rounded-full" />
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
                            strokeWidth="7"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            stroke="#F23869"
                            strokeWidth="7"
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
                  <span className="text-xs text-muted-foreground font-medium">Entrega</span>
                </div>

                {/* Taxa de leitura */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative h-24 w-24 flex items-center justify-center">
                    {s.isPending || c.isPending ? (
                      <Skeleton className="h-24 w-24 rounded-full" />
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
                            strokeWidth="7"
                            fill="transparent"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            stroke="#FBBF24"
                            strokeWidth="7"
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
                  <span className="text-xs text-muted-foreground font-medium">Leitura</span>
                </div>
              </div>
            </Card>

            {/* Atividade Geral (Direita) */}
            <Card className="lg:col-span-7 p-5 sm:p-6 bg-card border shadow-xs rounded-2xl flex flex-col justify-between min-h-[220px]">
              <div>
                <h3 className="font-display text-xs font-bold tracking-wider text-muted-foreground/90 uppercase">
                  ATIVIDADE GERAL
                </h3>
              </div>

              <div className="mt-4 space-y-4 w-full">
                {(() => {
                  const totalContacts = (contactsQuery.data && contactsQuery.data.length > 0) ? contactsQuery.data.length : (s.data?.contacts.current ?? 0);
                  const totalCampaigns = c.data?.length ?? s.data?.campaigns.current ?? 0;
                  const totalFailed = totals.failed;
                  const maxVal = Math.max(totalContacts, 1);

                  const items = [
                    {
                      label: "Contatos",
                      value: totalContacts.toLocaleString("pt-BR"),
                      pending: s.isPending,
                      color: "bg-blue-500",
                      pct: 100,
                    },
                    {
                      label: "Campanhas",
                      value: totalCampaigns.toLocaleString("pt-BR"),
                      pending: c.isPending || s.isPending,
                      color: "bg-amber-500",
                      pct: totalCampaigns > 0 ? Math.max((totalCampaigns / maxVal) * 100, 4) : 0,
                    },
                    {
                      label: "Falhas",
                      value: totalFailed.toLocaleString("pt-BR"),
                      pending: c.isPending,
                      color: "bg-red-500",
                      pct: totalFailed > 0 ? Math.max((totalFailed / maxVal) * 100, 4) : 0,
                    },
                  ];

                  return items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-20 sm:w-24 text-xs font-medium text-muted-foreground shrink-0">
                        {item.label}
                      </span>
                      <div className="flex-1 h-2.5 bg-muted/40 rounded-full overflow-hidden relative">
                        {item.pending ? (
                          <Skeleton className="h-full w-1/3 rounded-full" />
                        ) : (
                          <div
                            className={cn("h-full rounded-full transition-all duration-500 ease-out", item.color)}
                            style={{ width: `${item.pct}%` }}
                          />
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground shrink-0 min-w-[45px] text-right font-display">
                        {item.pending ? (
                          <Skeleton className="h-4 w-8 ml-auto" />
                        ) : (
                          item.value
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Card>
          </div>

          {/* ========================================================= */}
          {/* BOTTOM SECTION: Full-Width Unified Campaign Status Card   */}
          {/* ========================================================= */}
          <Card className="p-4 sm:p-5 rounded-2xl border bg-card shadow-xs">
            {c.isPending ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : filteredCampaigns.length > 0 ? (
              <div className="space-y-4 divide-y divide-border/30">
                {filteredCampaigns.slice(0, 5).map((camp: any, idx: number) => {
                  const n = normalizeCampaignTotals(camp.totals);
                  const total = n.total;
                  return (
                    <div
                      key={camp.id}
                      className={cn(
                        "flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4",
                        idx > 0 && "pt-4"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm sm:text-base text-foreground uppercase tracking-wide shrink-0 md:min-w-[140px]">
                          {camp.name}
                        </div>
                        <div className="md:hidden text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {n.failed > 0 ? (
                            <span className="text-red-500 font-medium">{n.failed} falhas</span>
                          ) : (
                            <span>{total} total</span>
                          )}
                        </div>
                      </div>

                      {/* Progress / Status Distribution Bar */}
                      <div className="flex-1 w-full h-2.5 rounded-full bg-muted overflow-hidden flex">
                        {n.failed > 0 && (
                          <div
                            className="bg-red-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${total > 0 ? (n.failed / total) * 100 : 100}%` }}
                            title={`Falhou: ${n.failed}`}
                          />
                        )}
                        {n.read > 0 && (
                          <div
                            className="bg-indigo-600 h-full transition-all duration-500"
                            style={{ width: `${total > 0 ? (n.read / total) * 100 : 0}%` }}
                            title={`Lida: ${n.read}`}
                          />
                        )}
                        {n.delivered - n.read > 0 && (
                          <div
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${total > 0 ? ((n.delivered - n.read) / total) * 100 : 0}%` }}
                            title={`Entregue: ${n.delivered - n.read}`}
                          />
                        )}
                        {n.sent - n.delivered > 0 && (
                          <div
                            className="bg-blue-500 h-full transition-all duration-500"
                            style={{ width: `${total > 0 ? ((n.sent - n.delivered) / total) * 100 : 0}%` }}
                            title={`Enviada: ${n.sent - n.delivered}`}
                          />
                        )}
                        {n.pending > 0 && (
                          <div
                            className="bg-amber-500 h-full transition-all duration-500"
                            style={{ width: `${total > 0 ? (n.pending / total) * 100 : 0}%` }}
                            title={`Pendente: ${n.pending}`}
                          />
                        )}
                      </div>

                      <div className="hidden md:block text-xs font-semibold text-muted-foreground shrink-0 whitespace-nowrap min-w-[70px] text-right">
                        {n.failed > 0 ? (
                          <span className="text-red-500 font-medium">{n.failed} falhas</span>
                        ) : (
                          <span>{total} total</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-2">
                Nenhuma campanha cadastrada
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
