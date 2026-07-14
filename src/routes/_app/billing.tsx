import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { getBillingReport } from "@/lib/billing.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Receipt,
  MessageSquare,
  CheckCheck,
  XCircle,
  DollarSign,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  QrCode,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

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
  usePageHeader({ title: "Faturamento & Consumo", subtitle: "Gerencie sua assinatura, faturas e acompanhe o consumo de mensagens da plataforma." });

  const fetchReport = useServerFn(getBillingReport);
  const [month, setMonth] = useState(currentMonth());
  const qc = useQueryClient();

  // Queries
  const { data: reportData, isLoading: isReportLoading } = useQuery({
    queryKey: ["billing-report", month],
    queryFn: () => fetchReport({ data: { month } }),
  });

  const { data: subData, isLoading: isSubLoading, refetch: refetchSub } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: async () => {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/subscription", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar dados da assinatura.");
      return res.json();
    },
  });

  const { data: plansData, isLoading: isPlansLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar planos.");
      return res.json();
    },
  });

  const { data: invoicesData, isLoading: isInvoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: async () => {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar faturas.");
      return res.json();
    },
  });

  const { data: keyData } = useQuery({
    queryKey: ["billing-public-key"],
    queryFn: async () => {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/public-key", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  // Modal / Checkout states
  const [checkoutPlan, setCheckoutPlan] = useState<any>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<"pix" | "card" | "redirect" | null>(null);
  
  // Checkout transparent state
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Credit Card Form State
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardDocType, setCardDocType] = useState("CPF");
  const [cardDocNumber, setCardDocNumber] = useState("");
  const [cardEmail, setCardEmail] = useState("");

  const pollIntervalRef = useRef<any>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll Payment Status
  const startPollingPaymentStatus = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPaymentId(id);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem("app-token");
        const res = await fetch(`/api/billing/payments/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setPaymentStatus(data.status);

        if (data.status === "approved" || data.status === "paid") {
          clearInterval(pollIntervalRef.current);
          toast.success("Pagamento confirmado com sucesso!");
          refetchSub();
          refetchInvoices();
          setTimeout(() => {
            handleCloseCheckout();
          }, 3000);
        } else if (data.status === "rejected" || data.status === "cancelled") {
          clearInterval(pollIntervalRef.current);
          toast.error("O pagamento foi recusado ou cancelado.");
        }
      } catch (err) {}
    }, 4000);
  };

  const handleCloseCheckout = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setCheckoutPlan(null);
    setCheckoutMethod(null);
    setPixData(null);
    setPaymentId(null);
    setPaymentStatus(null);
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardName("");
    setCardDocNumber("");
    setCardEmail("");
  };

  // Checkout mutations
  const handleCheckoutRedirect = async (plan: any) => {
    setLoadingCheckout(true);
    try {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao iniciar checkout.");

      // Open Mercado Pago Redirect in new window
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        toast.info("Guia de pagamento aberta em nova aba.");
        setCheckoutMethod("redirect");
        startPollingPaymentStatus(result.preferenceId); // We check preference/invoice status
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleCheckoutPix = async (plan: any) => {
    setLoadingCheckout(true);
    try {
      const token = localStorage.getItem("app-token");
      const res = await fetch("/api/billing/checkout/pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          payer: {
            email: cardEmail || "billing@saas.com",
            first_name: cardName.split(" ")[0] || "Cliente",
            last_name: cardName.split(" ").slice(1).join(" ") || "SaaS",
            identification: cardDocNumber ? {
              type: cardDocType,
              number: cardDocNumber,
            } : undefined,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao gerar PIX.");

      setPixData(result);
      setCheckoutMethod("pix");
      startPollingPaymentStatus(result.paymentId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleCheckoutCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName || !cardDocNumber) {
      toast.error("Por favor, preencha todos os campos do cartão.");
      return;
    }

    const [expMonth, expYear] = cardExpiry.split("/");
    if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2) {
      toast.error("Data de validade inválida. Use o formato MM/AA.");
      return;
    }

    setLoadingCheckout(true);
    try {
      const publicKey = keyData?.publicKey;
      if (!publicKey) throw new Error("Chave pública do Mercado Pago não localizada.");

      // 1. Get Card Token from Mercado Pago
      const cleanCard = cardNumber.replace(/\s/g, "");
      const cleanDoc = cardDocNumber.replace(/\D/g, "");

      const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cleanCard,
          expiration_month: parseInt(expMonth, 10),
          expiration_year: parseInt("20" + expYear, 10),
          security_code: cardCvv,
          cardholder: {
            name: cardName,
            identification: {
              type: cardDocType,
              number: cleanDoc,
            },
          },
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.id) {
        throw new Error(tokenData.message || tokenData.cause?.[0]?.description || "Falha ao tokenizar cartão.");
      }

      // 2. Submit payment to card checkout endpoint
      const token = localStorage.getItem("app-token");
      const payRes = await fetch("/api/billing/checkout/card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: checkoutPlan.id,
          token: tokenData.id,
          payment_method_id: tokenData.payment_method_id,
          installments: 1,
          payer: {
            email: cardEmail || "billing@saas.com",
            identification: {
              type: cardDocType,
              number: cleanDoc,
            },
          },
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || "Falha ao processar pagamento.");

      if (payData.status === "approved") {
        setPaymentStatus("approved");
        toast.success("Assinatura renovada com sucesso via cartão de crédito!");
        refetchSub();
        refetchInvoices();
        setTimeout(() => handleCloseCheckout(), 2500);
      } else {
        setPaymentStatus(payData.status);
        toast.warning(`Pagamento em processamento: ${payData.statusDetail || payData.status}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar cartão.");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const copyPixCode = () => {
    if (!pixData?.copiaCola) return;
    navigator.clipboard.writeText(pixData.copiaCola);
    setCopiedPix(true);
    toast.success("Código Copia e Cola copiado!");
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const getSubStatusLabel = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500 hover:bg-green-600 font-semibold px-2 py-0.5">Ativo</Badge>;
      case "expiring": return <Badge className="bg-yellow-500 hover:bg-yellow-600 font-semibold px-2 py-0.5">Expirando</Badge>;
      case "past_due": return <Badge className="bg-orange-500 hover:bg-orange-600 font-semibold px-2 py-0.5">Atrasado</Badge>;
      case "suspended": return <Badge variant="destructive" className="font-semibold px-2 py-0.5">Suspenso</Badge>;
      case "trial": return <Badge className="bg-blue-500 hover:bg-blue-600 font-semibold px-2 py-0.5">Período de Testes</Badge>;
      default: return <Badge variant="outline" className="font-semibold px-2 py-0.5">{status}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50/50 dark:bg-green-950/20 font-medium px-2 py-0.5">Paga</Badge>;
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 font-medium px-2 py-0.5">Pendente</Badge>;
      case "failed": return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50/50 dark:bg-red-950/20 font-medium px-2 py-0.5">Falhou</Badge>;
      default: return <Badge variant="outline" className="font-medium px-2 py-0.5">{status}</Badge>;
    }
  };

  const totals = reportData?.totals;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="subscription" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 p-1">
            <TabsTrigger value="subscription" className="font-medium">Assinatura & Planos</TabsTrigger>
            <TabsTrigger value="consumption" className="font-medium">Consumo da API Meta</TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscription" className="space-y-6 outline-none">
            {/* Expiration warnings */}
            {subData?.subscription && (subData.subscription.status === "expiring" || subData.subscription.status === "past_due" || subData.subscription.status === "suspended") && (
              <div className={cn(
                "p-4 rounded-lg border flex items-start gap-3 text-sm transition-all shadow-sm",
                subData.subscription.status === "suspended"
                  ? "bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-400"
                  : "bg-yellow-500/10 border-yellow-500/25 text-yellow-800 dark:text-yellow-400"
              )}>
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block text-base">
                    {subData.subscription.status === "suspended"
                      ? "Acesso Suspenso - Assinatura Vencida"
                      : "Assinatura Próxima do Vencimento"}
                  </span>
                  <span className="block text-sm opacity-90 mt-1">
                    {subData.subscription.status === "suspended"
                      ? "Sua assinatura expirou e o acesso aos recursos do sistema foi suspenso. Efetue o pagamento de renovação agora para liberar automaticamente."
                      : `Sua assinatura vence em breve (vencimento: ${new Date(subData.subscription.expires_at).toLocaleDateString("pt-BR")}). Renove agora para evitar a interrupção das suas automações.`}
                  </span>
                </div>
              </div>
            )}

            {/* Current plan card */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="col-span-2 shadow-sm border-muted/65">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Plano Atual
                  </CardTitle>
                  <CardDescription>Status atual de uso da sua empresa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isSubLoading ? (
                    <div className="h-24 flex items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Carregando...</div>
                  ) : subData?.subscription ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block uppercase font-medium">Plano</span>
                        <span className="font-bold text-lg text-primary">{subData.plan?.name || "Trial"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block uppercase font-medium">Status</span>
                        <div className="mt-0.5">{getSubStatusLabel(subData.subscription.status)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block uppercase font-medium">Vencimento</span>
                        <span className="font-semibold text-foreground">
                          {new Date(subData.subscription.expires_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground block uppercase font-medium">Valor</span>
                        <span className="font-semibold text-foreground">R$ {subData.plan?.price || "0,00"}/mês</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma assinatura localizada.</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="shadow-sm border-muted/65">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-muted-foreground" /> Renovação Automática
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>A compensação e a ativação de planos ocorrem de forma 100% automática após a aprovação no Mercado Pago.</p>
                  <p>Pagamentos em <strong>PIX</strong> e <strong>Cartão de Crédito</strong> liberam o acesso em poucos segundos.</p>
                </CardContent>
              </Card>
            </div>

            {/* Plans List */}
            <div>
              <h2 className="text-lg font-bold mb-4">Escolha um Plano para Contratar ou Renovar</h2>
              {isPlansLoading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plansData?.plans?.map((plan: any) => {
                    const isCurrent = subData?.subscription?.plan_id === plan.id;
                    return (
                      <Card key={plan.id} className={cn(
                        "relative flex flex-col justify-between overflow-hidden shadow-sm transition-all hover:shadow-md border-muted/65",
                        isCurrent && "border-primary/55 ring-1 ring-primary/20 bg-primary/5"
                      )}>
                        {isCurrent && (
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 font-bold rounded-bl-lg">
                            Atual
                          </div>
                        )}
                        <CardHeader>
                          <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                          <CardDescription className="line-clamp-2 min-h-[40px]">{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-baseline">
                            <span className="text-3xl font-extrabold text-foreground">R$ {plan.price}</span>
                            <span className="text-muted-foreground text-sm ml-1">/ {plan.billing_interval === "month" ? "mês" : "ano"}</span>
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-2 border-t pt-4">
                            <li className="flex items-center gap-2">
                              <CheckCheck className="h-4 w-4 text-green-500" />
                              {plan.limits_connections} conexões de WhatsApp
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCheck className="h-4 w-4 text-green-500" />
                              Suporte prioritário
                            </li>
                          </ul>
                        </CardContent>
                        <div className="p-6 border-t bg-muted/20">
                          <Button
                            className="w-full font-bold !rounded-md"
                            variant={isCurrent ? "outline" : "default"}
                            onClick={() => {
                              setCheckoutPlan(plan);
                              setCheckoutMethod(null);
                            }}
                          >
                            {isCurrent ? "Renovar Plano" : "Assinar Plano"}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invoices History */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-muted-foreground" /> Histórico de Faturas
              </h2>
              <Card className="shadow-sm border-muted/65 overflow-hidden">
                <CardContent className="p-0">
                  {isInvoicesLoading ? (
                    <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
                  ) : invoicesData?.invoices?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b bg-muted/30">
                            <th className="p-4 font-semibold">Fatura</th>
                            <th className="p-4 font-semibold">Plano</th>
                            <th className="p-4 font-semibold">Emissão</th>
                            <th className="p-4 font-semibold">Vencimento</th>
                            <th className="p-4 font-semibold">Valor</th>
                            <th className="p-4 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicesData.invoices.map((inv: any) => (
                            <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/10">
                              <td className="p-4 font-mono font-medium text-xs text-foreground">{inv.invoice_number}</td>
                              <td className="p-4">{inv.plan_name || "Assinatura"}</td>
                              <td className="p-4">{new Date(inv.created_at).toLocaleDateString("pt-BR")}</td>
                              <td className="p-4">{new Date(inv.due_at).toLocaleDateString("pt-BR")}</td>
                              <td className="p-4 font-semibold">R$ {inv.amount}</td>
                              <td className="p-4 text-center">{getInvoiceStatusBadge(inv.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma fatura emitida até o momento.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Consumption Tab (Old billing view) */}
          <TabsContent value="consumption" className="space-y-6 outline-none">
            <Card className="p-4 flex flex-row items-center gap-4 py-3 border-muted/65 shadow-sm">
              <div className="max-w-xs space-y-1">
                <Label htmlFor="month" className="text-xs text-muted-foreground">Mês de referência</Label>
                <MonthPicker value={month} onChange={setMonth} />
              </div>
            </Card>

            {isReportLoading || !totals ? (
              <div className="flex min-h-[400px] items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Carregando consumo da Meta...</p>
              </div>
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

                <Card className="p-6 border-muted/65 shadow-sm">
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
                            <td colSpan={3} className="py-6 text-center text-muted-foreground">Sem dados de cobrança neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-6 bg-muted/30 border-muted/65 shadow-sm">
                  <div className="flex gap-3">
                    <CheckCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">Como funciona a cobrança da Meta</p>
                      <p className="text-muted-foreground">
                        Toda primeira mensagem para um contato em uma janela de 24h abre uma <strong>conversa cobrada</strong>. Mensagens subsequentes dentro da mesma janela são gratuitas. O preço varia por categoria (marketing, utilidade, autenticação, serviço) e país do destinatário.
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Selection / Transparent / PIX Modal */}
      <Dialog open={!!checkoutPlan} onOpenChange={(o) => { if (!o) handleCloseCheckout(); }}>
        <DialogContent className="max-w-md w-full p-6 sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Renovação da Assinatura</DialogTitle>
            <DialogDescription>
              Você escolheu o plano <strong>{checkoutPlan?.name}</strong> por <strong>R$ {checkoutPlan?.price}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Checkout Method Selection */}
          {!checkoutMethod && (
            <div className="grid gap-3 pt-2">
              <Button
                variant="outline"
                className="flex items-center justify-between p-4 h-auto hover:bg-primary/5 hover:border-primary/50 text-left font-normal"
                onClick={() => handleCheckoutPix(checkoutPlan)}
                disabled={loadingCheckout}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-md text-green-600">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">Pagar com PIX</span>
                    <span className="text-xs text-muted-foreground block">Compensação instantânea em segundos</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-between p-4 h-auto hover:bg-primary/5 hover:border-primary/50 text-left font-normal"
                onClick={() => {
                  setCheckoutMethod("card");
                  setCardEmail(subData?.subscription?.payer_email || "");
                }}
                disabled={loadingCheckout}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-md text-blue-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">Cartão de Crédito</span>
                    <span className="text-xs text-muted-foreground block">Insira os dados do cartão de forma segura</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-between p-4 h-auto hover:bg-primary/5 hover:border-primary/50 text-left font-normal"
                onClick={() => handleCheckoutRedirect(checkoutPlan)}
                disabled={loadingCheckout}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-md text-purple-600">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold block text-sm">Outros Meios (Mercado Pago)</span>
                    <span className="text-xs text-muted-foreground block">Boleto, saldo MP ou redirecionamento</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          )}

          {/* loading state */}
          {loadingCheckout && (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Comunicando com o Mercado Pago...</p>
            </div>
          )}

          {/* PIX view */}
          {checkoutMethod === "pix" && pixData && !loadingCheckout && (
            <div className="flex flex-col items-center gap-4 text-center py-2">
              <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-green-500"></span> Aguardando Pagamento...
              </span>

              {pixData.qrCodeBase64 && (
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <img
                    src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`}
                    alt="PIX QR Code"
                    className="h-44 w-44 object-contain"
                  />
                </div>
              )}

              <div className="w-full space-y-2">
                <Label className="text-xs text-muted-foreground text-left block">Código PIX Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={pixData.copiaCola}
                    className="bg-muted text-muted-foreground font-mono text-xs select-all text-left flex-1"
                  />
                  <Button size="icon" variant="outline" onClick={copyPixCode} className="shrink-0">
                    {copiedPix ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {paymentStatus === "approved" && (
                <div className="w-full bg-green-500/10 border border-green-500/25 p-3 rounded-lg text-green-700 dark:text-green-400 flex items-center gap-2.5">
                  <Check className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-bold text-left">Pagamento aprovado! Redirecionando...</span>
                </div>
              )}
            </div>
          )}

          {/* Card Form view */}
          {checkoutMethod === "card" && !loadingCheckout && (
            <form onSubmit={handleCheckoutCard} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="c_number">Número do Cartão</Label>
                <Input
                  id="c_number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19))}
                  placeholder="0000 0000 0000 0000"
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c_exp">Validade</Label>
                  <Input
                    id="c_exp"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value.replace(/\D/g, "").replace(/(.{2})/g, "$1/").slice(0, 5))}
                    placeholder="MM/AA"
                    className="font-mono text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c_cvv">CVC / CVV</Label>
                  <Input
                    id="c_cvv"
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    className="font-mono text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c_name">Nome no Cartão</Label>
                <Input
                  id="c_name"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="NOME COMPLETO"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c_doc_type">Tipo Doc.</Label>
                  <Select value={cardDocType} onValueChange={setCardDocType}>
                    <SelectTrigger id="c_doc_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="c_doc">Número Documento</Label>
                  <Input
                    id="c_doc"
                    value={cardDocNumber}
                    onChange={(e) => setCardDocNumber(e.target.value)}
                    placeholder="Somente números"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c_email">E-mail para Recibo</Label>
                <Input
                  id="c_email"
                  type="email"
                  value={cardEmail}
                  onChange={(e) => setCardEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              {paymentStatus && paymentStatus !== "approved" && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-400 rounded-lg text-sm flex gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="font-bold block">Pagamento Recusado</span>
                    <span className="text-xs">Verifique os dados informados ou contate a operadora do seu cartão. Status: {paymentStatus}</span>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loadingCheckout} className="w-full font-bold !rounded-md">
                Pagar via Cartão de Crédito
              </Button>
            </form>
          )}

          {/* Redirect / Preference open state display */}
          {checkoutMethod === "redirect" && !loadingCheckout && (
            <div className="flex flex-col items-center gap-4 text-center py-4">
              <span className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-purple-500"></span> Aguardando compensação...
              </span>
              <p className="text-sm text-muted-foreground">
                Sua fatura foi enviada para o Mercado Pago. A liberação ocorrerá automaticamente assim que o pagamento for concluído na guia externa.
              </p>
              <Button variant="outline" className="gap-2" onClick={() => window.open(pixData?.checkoutUrl, "_blank")}>
                <ExternalLink className="h-4 w-4" /> Abrir guia novamente
              </Button>

              {paymentStatus === "approved" && (
                <div className="w-full bg-green-500/10 border border-green-500/25 p-3 rounded-lg text-green-700 dark:text-green-400 flex items-center gap-2.5">
                  <Check className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-bold text-left">Pagamento confirmado com sucesso!</span>
                </div>
              )}
            </div>
          )}

          {/* Cancel button if waiting */}
          {checkoutMethod && (
            <div className="border-t pt-4 mt-4 flex justify-end">
              <Button variant="ghost" onClick={handleCloseCheckout}>
                Voltar / Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
    <Card className="p-5 border-muted/65 shadow-sm">
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
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const MONTH_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
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
