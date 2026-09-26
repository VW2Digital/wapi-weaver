import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { AppToolbar, ToolbarPrimary } from "@/components/layout/app-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Globe,
  CreditCard,
  Calendar,
  Receipt,
} from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRoles } from "@/hooks/use-roles";
import { hasMasterRole } from "@/lib/roles";
import {
  getLicenseDetail,
  updateLicense,
  deleteActivation,
  listPlans,
} from "@/lib/license-admin.functions";

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function formatMoney(amount: number | string | null | undefined, currency = "BRL") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: currency || "BRL" });
}

function subscriptionStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    trial: "Período de teste",
    active: "Ativa",
    expiring: "A vencer",
    pending_payment: "Aguardando pagamento",
    past_due: "Pagamento atrasado",
    suspended: "Suspensa",
    cancelled: "Cancelada",
  };
  return status ? map[status] || status : "Sem assinatura";
}

function paymentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    approved: "Aprovado",
    pending: "Pendente",
    in_process: "Em processamento",
    authorized: "Autorizado",
    rejected: "Recusado",
    failed: "Falhou",
    cancelled: "Cancelado",
    refunded: "Estornado",
    expired: "Expirado",
  };
  return status ? map[status] || status : "—";
}

function paymentMethodLabel(method?: string | null) {
  const map: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    account_money: "Saldo Mercado Pago",
    ticket: "Boleto",
  };
  return method ? map[method] || method : "—";
}

function billingCycleLabel(interval?: string | null, count?: number | null, cycle?: string | null) {
  if (cycle === "monthly" || interval === "month") {
    return count && count > 1 ? `A cada ${count} meses` : "Mensal";
  }
  if (cycle === "yearly" || interval === "year") {
    return count && count > 1 ? `A cada ${count} anos` : "Anual";
  }
  if (interval === "week") return "Semanal";
  if (interval === "day") return count && count > 1 ? `A cada ${count} dias` : "Diário";
  return "—";
}

function LicenseDetailPage() {
  const { id } = Route.useParams();
  const licenseId = String(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const fetchDetail = useServerFn(getLicenseDetail);
  const updateLicenseMut = useServerFn(updateLicense);
  const deleteActivationMut = useServerFn(deleteActivation);
  const fetchPlans = useServerFn(listPlans);

  const { roles, loading: roleLoading } = useRoles();
  const isAdminMasterUser = hasMasterRole(roles);

  const { data, isLoading, error } = useQuery({
    queryKey: ["license-detail", licenseId],
    queryFn: () => fetchDetail({ data: { id: licenseId } }),
    enabled: isAdminMasterUser,
  });

  const { data: plansData } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => fetchPlans({}),
    enabled: isAdminMasterUser,
  });

  const availablePlans = useMemo(() => {
    const plans = (plansData?.plans || []).map((p: any) => ({
      value: String(p.slug || p.id),
      id: String(p.id),
      slug: String(p.slug || p.id),
      name: String(p.name || p.slug || p.id),
    }));
    const current = data?.subscription?.plan_id || data?.license?.plan;
    if (
      current &&
      !plans.some((p) => p.id === String(current) || p.slug === String(current) || p.value === String(current))
    ) {
      plans.push({
        value: String(current),
        id: String(current),
        slug: String(current),
        name: data?.subscription?.plan_name || String(current),
      });
    }
    return plans;
  }, [plansData, data]);

  // Edit fields state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [plan, setPlan] = useState("basic");
  const [status, setStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data?.license) {
      const lic = data.license;
      const sub = data.subscription;
      setClientName(lic.client_name || "");
      setClientEmail(lic.client_email || "");
      setStatus(lic.status || "active");
      setNotes(lic.notes || "");

      const planKey = sub?.plan_id || lic.plan || "";
      const match = availablePlans.find(
        (p) => p.id === String(planKey) || p.slug === String(planKey) || p.value === String(planKey),
      );
      setPlan(match?.value || String(planKey || ""));

      const expiresSource = sub?.expires_at || lic.expires_at;
      if (expiresSource) {
        const d = new Date(expiresSource);
        if (!Number.isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          setExpiresAt(`${yyyy}-${mm}-${dd}`);
        } else {
          setExpiresAt("");
        }
      } else {
        setExpiresAt("");
      }
    }
  }, [data, availablePlans]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateLicenseMut({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-detail", licenseId] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      toast.success("Domínio atualizado com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar domínio.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (activationId: string) => deleteActivationMut({ data: { id: activationId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-detail", licenseId] });
      toast.success("Instancia removida com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao remover instancia.");
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: licenseId,
      client_name: clientName,
      client_email: clientEmail,
      plan,
      status,
      max_activations: 99,
      expires_at: expiresAt || null,
      notes,
    });
  };

  const handleRevoke = async (actId: string, domain: string) => {
    const ok = await confirm({
      title: "Revogar Instância",
      description: `Tem certeza que deseja revogar esta conexão ativa da máquina do domínio ${domain}? Ela será recriada automaticamente na próxima requisição se o acesso continuar ativo.`,
      confirmText: "Revogar",
      destructive: true,
    });
    if (ok) {
      revokeMutation.mutate(actId);
    }
  };

  const license = data?.license;
  const subscription = data?.subscription;
  const planLabel =
    subscription?.plan_name ||
    availablePlans.find((p) => p.value === plan || p.id === license?.plan)?.name ||
    license?.plan ||
    "—";

  usePageHeader({
    title: license?.client_name || license?.client_email || license?.license_key_preview || "",
    subtitle: license
      ? `${license.client_email || "Sem e-mail"} · ${planLabel} · ${subscriptionStatusLabel(subscription?.status)}`
      : "",
    action: license ? (
      <AppToolbar>
        <Badge variant="outline" className="capitalize">
          {subscriptionStatusLabel(subscription?.status)}
        </Badge>
        <ToolbarPrimary>
        <Button variant="outline" size="sm" asChild>
          <Link to="/licenses">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        </ToolbarPrimary>
      </AppToolbar>
    ) : undefined,
  });

  if (roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Verificando permissões...
      </div>
    );
  }

  if (!isAdminMasterUser) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-20 space-y-4">
        <h2 className="text-2xl font-bold text-red-500">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Você não possui privilégios de Administrador Master (admin_master) para visualizar este domínio.
        </p>
        <Button asChild>
          <Link to="/">Voltar para o início</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando detalhes...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-500">Erro ao carregar detalhes</h2>
        <p className="text-muted-foreground mt-2">O domínio solicitado pode ter sido removido.</p>
        <Button className="mt-4" asChild>
          <Link to="/licenses">Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  // Após os guards, data está garantido — desestrutura sem opcional para satisfazer o TypeScript
  const { activations: acts, subscription: sub, payments: paymentEntries = [] } = data;

  return (
    <div className="space-y-8 p-6 pb-16">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Update Form */}
        <Card className="md:col-span-1 shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Editar Propriedades</CardTitle>
            <CardDescription>
              Nome, e-mail, plano e validade são gravados na licença e na assinatura do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="cname">Nome do Cliente</Label>
                <Input
                  id="cname"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cemail">E-mail do Cliente</Label>
                <Input
                  id="cemail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="plan">Plano</Label>
                <Select value={plan || undefined} onValueChange={setPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((p) => (
                      <SelectItem key={p.id} value={p.value}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Plano da assinatura: {planLabel}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expires">Expira em</Label>
                <Input
                  id="expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas Internas</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Assinatura</CardTitle>
              <CardDescription>
                Situação comercial deste cliente, com vigência e plano efetivos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!license.tenant_id ? (
                <p className="text-sm text-muted-foreground">
                  Este cadastro ainda não está vinculado a um usuário. Sem tenant não há assinatura nem
                  pagamentos para exibir.
                </p>
              ) : !sub ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma assinatura encontrada para este cliente.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline">{subscriptionStatusLabel(sub.status)}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Plano</p>
                    <p className="text-sm font-medium">{sub.plan_name || planLabel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ciclo</p>
                    <p className="text-sm font-medium">
                      {billingCycleLabel(
                        sub.billing?.billing_interval,
                        sub.billing?.billing_interval_count,
                        sub.billing?.billing_cycle,
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor do plano</p>
                    <p className="text-sm font-medium">
                      {sub.billing
                        ? formatMoney(
                            Number(sub.billing.price) || Number(sub.billing.price_cents) / 100,
                            sub.billing.currency,
                          )
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(sub.current_period_start || sub.starts_at)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Expira em</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(sub.expires_at || sub.current_period_end)}
                    </p>
                  </div>
                  {sub.status === "trial" ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Teste até</p>
                      <p className="text-sm font-medium">{formatDateTime(sub.trial_ends_at)}</p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Último pagamento</p>
                    <p className="text-sm font-medium">{formatDateTime(sub.last_payment_at)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                    <p className="text-sm font-medium">{formatDateTime(sub.next_billing_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Activations */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Conexões Ativas ({acts.length})</CardTitle>
              <CardDescription>Instâncias reportando requisições com este domínio.</CardDescription>
            </CardHeader>
            <CardContent>
              {!acts.length ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Globe className="h-8 w-8 mb-2 opacity-40" />
                  Nenhum servidor ativado atualmente.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instância ID</TableHead>
                        <TableHead>Última Checagem</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="w-[100px] text-right">Revogar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acts.map((act) => {
                        const lastCheck = act.last_check_at
                          ? new Date(act.last_check_at).toLocaleString()
                          : "N/A";
                        return (
                          <TableRow key={act.id}>
                            <TableCell className="font-medium font-mono text-xs">
                              {act.installation_id}
                            </TableCell>
                            <TableCell className="text-sm">{lastCheck}</TableCell>
                            <TableCell className="text-sm font-mono">
                              {act.ip_address || "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleRevoke(act.id, act.domain)}
                                disabled={revokeMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Histórico de pagamentos</CardTitle>
              <CardDescription>Faturas e transações do Mercado Pago deste cliente.</CardDescription>
            </CardHeader>
            <CardContent>
              {!license.tenant_id ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Receipt className="h-8 w-8 mb-2 opacity-40" />
                  Sem tenant vinculado para listar pagamentos.
                </div>
              ) : !paymentEntries.length ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mb-2 opacity-40" />
                  Nenhum pagamento registrado.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fatura</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentEntries.map((payment: any) => {
                        const paid = payment.status === "approved";
                        const failed =
                          payment.status === "rejected" ||
                          payment.status === "failed" ||
                          payment.status === "cancelled" ||
                          payment.status === "expired";
                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {formatDateTime(payment.approved_at || payment.created_at)}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">
                                {payment.billing_plan_name || payment.description || "Assinatura"}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {payment.invoice_number || payment.provider_payment_id || payment.id}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {paymentMethodLabel(payment.payment_method)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {formatMoney(payment.amount, payment.currency)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  paid
                                    ? "text-green-600 text-xs font-semibold"
                                    : failed
                                      ? "text-red-600 text-xs font-semibold"
                                      : "text-amber-600 text-xs font-semibold"
                                }
                              >
                                {paymentStatusLabel(payment.status)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/licenses/$id")({
  component: LicenseDetailPage,
});
