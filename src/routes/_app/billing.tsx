import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { getBillingReport } from "@/lib/billing.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Receipt,
  MessageSquare,
  CheckCheck,
  DollarSign,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/billing")({ component: BillingPage });

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  marketing_lite: "Marketing lite",
  utility: "Utilidade",
  authentication: "Autenticação",
  authentication_international: "Autenticação internacional",
  service: "Serviço",
  referral_conversion: "Conversão por indicação",
  unknown: "Sem categoria",
};

const TYPE_LABELS: Record<string, string> = {
  regular: "Cobrada",
  free_tier: "Faixa gratuita",
  free_entry_point: "Entrada gratuita",
  free_customer_service: "Gratuita (janela de atendimento)",
  unknown: "Não classificado",
};

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  marketing_lite: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  utility: "bg-green-500/15 text-green-600 dark:text-green-400",
  authentication: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  authentication_international: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  service: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  referral_conversion: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  unknown: "bg-muted text-muted-foreground",
};

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function BillingPage() {
  const fetchReport = useServerFn(getBillingReport);
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["billing", month],
    queryFn: () => fetchReport({ data: { month } }),
  });

  const totals = data?.totals;

  usePageHeader({
    title: "Consumo & Faturamento",
    subtitle: "Consumo cobrado pela Meta na WhatsApp Business Account conectada a este tenant.",
  });

  return (
    <div className="flex flex-col h-full">

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="p-4 flex flex-row items-center gap-4 py-3">
          <div className="max-w-xs space-y-1">
            <Label htmlFor="month" className="text-xs text-muted-foreground">
              Mês de referência
            </Label>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        </Card>

        {isLoading ? (
          <div
            className="flex min-h-[400px] items-center justify-center gap-3 text-muted-foreground"
            role="status"
          >
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <p className="text-sm">Consultando a Meta...</p>
          </div>
        ) : isError || !totals ? (
          <Card className="p-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Não foi possível carregar o consumo da Meta."}
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Fonte: Graph API {data.ok ? "da WABA conectada" : "indisponível"}
                {data.wabaName ? ` · ${data.wabaName}` : ""}
                {data.wabaId ? ` · ${data.wabaId}` : ""}
              </p>
              <p>Valores da Meta são aproximados e podem diferir da fatura oficial.</p>
            </div>

            {data.error && (
              <Card className="p-4 text-sm border-destructive/30 bg-destructive/10 text-destructive">
                {data.error}
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Receipt}
                label="Conversas na Meta"
                value={totals.conversations}
                hint={`${totals.billable_conversations} cobradas · ${totals.free_conversations} gratuitas`}
              />
              <StatCard
                icon={DollarSign}
                label="Custo aproximado"
                value={
                  totals.cost_available
                    ? formatMetaMoney(totals.cost, data.currency)
                    : "Indisponível"
                }
                hint={
                  totals.cost_available
                    ? "Soma informada pela Meta neste mês"
                    : "A Meta não devolve custo quando a cobrança passa pelo parceiro"
                }
                accent
              />
              <StatCard
                icon={CheckCheck}
                label="Mensagens entregues"
                value={totals.delivered}
                hint={`${totals.sent} enviadas (analytics da WABA)`}
              />
              <StatCard
                icon={MessageSquare}
                label="Mensagens cobradas"
                value={totals.billable_messages}
                hint={`${totals.free_messages} gratuitas no pricing analytics`}
              />
            </div>

            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold mb-1">Conversas por categoria</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Campo oficial <code className="text-xs">conversation_analytics</code> da WABA. A Meta
                ainda reporta janelas de conversa; o preço efetivo recente vem do pricing por
                mensagem, abaixo.
              </p>
              <BillingTable
                headers={["Categoria", "Tipo", "Conversas", "Custo"]}
                empty="A Meta não registrou conversas neste mês nesta WABA."
                rows={totals.by_conversation_category.map((row) => [
                  categoryBadge(row.category),
                  typeLabel(row.type),
                  row.conversations.toLocaleString("pt-BR"),
                  totals.cost_available ? formatMetaMoney(row.cost, data.currency) : "—",
                ])}
              />
            </Card>

            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold mb-1">Mensagens por preço</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Campo oficial <code className="text-xs">pricing_analytics</code>. SERVICE e mensagens
                dentro da janela de atendimento entram como gratuitas; templates de marketing,
                utilidade e autenticação fora da janela são cobrados.
              </p>
              <BillingTable
                headers={["Categoria", "Tipo", "Mensagens", "Custo"]}
                empty="A Meta não registrou volume de mensagens cobradas neste mês nesta WABA."
                rows={totals.by_pricing_category.map((row) => [
                  categoryBadge(row.category),
                  typeLabel(row.type),
                  row.volume.toLocaleString("pt-BR"),
                  totals.cost_available ? formatMetaMoney(row.cost, data.currency) : "—",
                ])}
              />
            </Card>

            <Card className="p-6 bg-muted/30">
              <div className="flex gap-3">
                <CheckCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">O que estes números são</p>
                  <p className="text-muted-foreground">
                    Estes totais vêm da conta WhatsApp Business (WABA) do cliente na Meta, não do
                    histórico interno da Bliv. A assinatura do CRM é outra cobrança. Se o cartão da
                    WABA estiver inválido, a Meta bloqueia envio e ligação mesmo com o CRM pago.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function labelOf(map: Record<string, string>, raw: string) {
  const key = raw.toLowerCase();
  return map[key] ?? raw;
}

function categoryBadge(category: string) {
  const key = category.toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[key] ?? CATEGORY_COLORS.unknown}`}
    >
      {labelOf(CATEGORY_LABELS, category)}
    </span>
  );
}

function typeLabel(type: string) {
  return labelOf(TYPE_LABELS, type);
}

function formatMetaMoney(value: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 4,
    }).format(value);
  } catch {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${currency || "USD"}`;
  }
}

function BillingTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            {headers.map((h, i) => (
              <th key={h} className={`py-2 font-medium ${i === 0 ? "" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-6 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, idx) => (
              <tr key={idx} className="border-b last:border-0">
                {cells.map((cell, ci) => (
                  <td key={ci} className={`py-3 ${ci === 0 ? "" : "text-right font-mono"}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : ""}`} />
        {label}
      </div>
      <div className={`font-display text-3xl font-semibold ${accent ? "text-primary" : ""}`}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const MONTH_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, month] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const now = new Date();
  const currentY = now.getUTCFullYear();
  const currentM = now.getUTCMonth() + 1;

  const label = `${MONTH_LONG[month - 1]} de ${year}`;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setViewYear(year);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id="month"
          variant="outline"
          className="w-full justify-start text-left font-normal capitalize"
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">{viewYear}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const selected = viewYear === year && m === month;
            const isFuture = viewYear > currentY || (viewYear === currentY && m > currentM);
            const isCurrent = viewYear === currentY && m === currentM;
            return (
              <button
                key={name}
                type="button"
                disabled={isFuture}
                onClick={() => {
                  onChange(`${viewYear}-${String(m).padStart(2, "0")}`);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2 py-2 text-sm transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground font-medium"
                    : isCurrent
                      ? "border border-primary/40 text-foreground hover:bg-accent"
                      : "text-foreground hover:bg-accent",
                  isFuture && "opacity-40 cursor-not-allowed hover:bg-transparent",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
