import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/campaigns.functions";
import { listContacts } from "@/lib/contacts.functions";
import { listTemplates } from "@/lib/templates.functions";
import { Card } from "@/components/ui/card";
import { Send, Users, FileText, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

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

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral dos seus disparos via WhatsApp Cloud API." />
      <div className="grid gap-4 p-6 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-2 font-display text-3xl font-semibold">{s.value.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-md bg-accent p-2 text-accent-foreground">
                <s.icon className="h-4 w-4" />
              </div>
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
        <h2 className="mb-3 font-display text-lg font-semibold">Últimas campanhas</h2>
        <Card className="divide-y">
          {(c.data ?? []).slice(0, 6).map((x: any) => (
            <div key={x.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{x.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString("pt-BR")} · {x.message_type}</p>
              </div>
              <div className="text-right text-xs">
                <span className="rounded-full bg-accent px-2 py-1 font-medium text-accent-foreground">{x.status}</span>
                <p className="mt-1 text-muted-foreground">{x.totals?.sent ?? 0} / {x.totals?.total ?? 0} enviadas</p>
              </div>
            </div>
          ))}
          {(c.data ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha criada ainda. Vá em <strong>Campanhas → Nova</strong> para começar.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
