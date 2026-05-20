import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listContacts } from "@/lib/contacts.functions";
import { listTemplates } from "@/lib/templates.functions";
import { Card } from "@/components/ui/card";
import { Send, Users, FileText, CheckCircle2 } from "lucide-react";
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
  pending: "oklch(0.556 0 0)",
  sent: "oklch(0.70 0.15 305)",
  delivered: "oklch(0.58 0.20 305)",
  read: "oklch(0.65 0.18 155)",
  failed: "oklch(0.62 0.22 25)",
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
  pending: "bg-muted-foreground/40",
  sent: "bg-primary/70",
  delivered: "bg-primary",
  read: "bg-success",
  failed: "bg-destructive",
};

function Dashboard() {
  const fetchCampaigns = useServerFn(listCampaigns);
  const fetchContacts = useServerFn(listContacts);
  const fetchTemplates = useServerFn(listTemplates);

  const c = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchCampaigns() });
  const ct = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });
  const t = useQuery({ queryKey: ["templates"], queryFn: () => fetchTemplates() });

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

  const stats = [
    { label: "Contatos", value: ct.data?.length ?? 0, icon: Users },
    { label: "Templates", value: t.data?.length ?? 0, icon: FileText },
    { label: "Campanhas", value: c.data?.length ?? 0, icon: Send },
    { label: "Entregas", value: totals.delivered, icon: CheckCircle2 },
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
      <PageHeader title="Dashboard" subtitle="Visão geral dos seus disparos via WhatsApp Cloud API." />
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4 p-6 md:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="flex items-center justify-between p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold leading-tight">{s.value.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                <s.icon className="h-4 w-4" />
              </div>
            </Card>
          ))}
        </div>

      <div className="grid gap-4 px-6 pb-6 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxa de entrega</p>
          <p className="mt-2 font-display text-3xl font-semibold">{deliverRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{totals.delivered} / {totals.sent} mensagens</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxa de leitura</p>
          <p className="mt-2 font-display text-3xl font-semibold">{readRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{totals.read} leituras confirmadas</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
          <p className="mt-2 font-display text-3xl font-semibold text-destructive">{totals.failed}</p>
          <p className="mt-1 text-xs text-muted-foreground">Verifique credenciais e templates</p>
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma campanha criada ainda. Vá em <strong>Campanhas → Nova</strong> para começar.
              </div>
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
