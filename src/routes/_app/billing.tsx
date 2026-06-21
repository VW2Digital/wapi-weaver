import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getBillingReport } from "@/lib/billing.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Receipt,
  MessageSquare,
  CheckCheck,
  XCircle,
  DollarSign,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/billing")({ component: BillingPage });

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  utility: "Utilidade",
  authentication: "Autenticação",
  service: "Serviço",
  unknown: "Sem categoria",
};

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  utility: "bg-green-500/15 text-green-600 dark:text-green-400",
  authentication: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  service: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  unknown: "bg-muted text-muted-foreground",
};

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function BillingPage() {
  const fetchReport = useServerFn(getBillingReport);
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading } = useQuery({
    queryKey: ["billing", month],
    queryFn: () => fetchReport({ data: { month } }),
  });

  const totals = data?.totals;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Consumo & Faturamento"
        subtitle="Acompanhe quantas conversas e mensagens foram cobradas pela Meta neste período."
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="p-4 flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="month">Mês de referência</Label>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        </Card>

        {isLoading || !totals ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={MessageSquare}
                label="Mensagens totais"
                value={totals.total_messages}
                hint={`${totals.sent + totals.delivered + totals.read} entregues`}
              />
              <StatCard
                icon={Receipt}
                label="Conversas únicas"
                value={totals.unique_conversations}
                hint="Janelas de 24h iniciadas"
              />
              <StatCard
                icon={DollarSign}
                label="Mensagens cobradas"
                value={totals.billable_messages}
                hint={`${totals.free_messages} livres na janela`}
                accent
              />
              <StatCard
                icon={XCircle}
                label="Falhas"
                value={totals.failed}
                hint="Erros de entrega"
              />
            </div>

            <Card className="p-6">
              <h2 className="font-display text-lg font-semibold mb-1">Conversas por categoria</h2>
              <p className="text-sm text-muted-foreground mb-4">
                A Meta cobra por <strong>conversa</strong> (janela de 24h), não por mensagem. Use
                isto para conferir sua fatura.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 font-medium">Categoria</th>
                      <th className="py-2 font-medium text-right">Conversas</th>
                      <th className="py-2 font-medium text-right">Mensagens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(totals.by_category)
                      .sort((a, b) => b[1].conversations - a[1].conversations)
                      .map(([cat, v]) => (
                        <tr key={cat} className="border-b last:border-0">
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.unknown}`}
                            >
                              {CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono">{v.conversations}</td>
                          <td className="py-3 text-right font-mono text-muted-foreground">
                            {v.messages}
                          </td>
                        </tr>
                      ))}
                    {Object.keys(totals.by_category).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-muted-foreground">
                          Sem dados de cobrança neste mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6 bg-muted/30">
              <div className="flex gap-3">
                <CheckCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Como funciona a cobrança da Meta</p>
                  <p className="text-muted-foreground">
                    Toda primeira mensagem para um contato em uma janela de 24h abre uma{" "}
                    <strong>conversa cobrada</strong>. Mensagens subsequentes dentro da mesma janela
                    são gratuitas. O preço varia por categoria (marketing, utilidade, autenticação,
                    serviço) e país do destinatário.
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
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
        {value.toLocaleString("pt-BR")}
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
