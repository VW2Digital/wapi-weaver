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
import { Receipt, MessageSquare, CheckCheck, XCircle, DollarSign, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

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
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
            />
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
                A Meta cobra por <strong>conversa</strong> (janela de 24h), não por mensagem. Use isto para conferir sua fatura.
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
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.unknown}`}>
                              {CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono">{v.conversations}</td>
                          <td className="py-3 text-right font-mono text-muted-foreground">{v.messages}</td>
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
                    Toda primeira mensagem para um contato em uma janela de 24h abre uma <strong>conversa cobrada</strong>.
                    Mensagens subsequentes dentro da mesma janela são gratuitas. O preço varia por categoria (marketing, utilidade, autenticação, serviço) e país do destinatário.
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
