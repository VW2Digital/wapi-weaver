import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  CreditCard,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Users,
  Kanban,
  UserCheck,
  Layers,
  Calendar,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicCommercialPlans } from "@/lib/billing.functions";

interface SubscriptionCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionCheckoutModal({ open, onOpenChange }: SubscriptionCheckoutModalProps) {
  const queryClient = useQueryClient();
  const fetchPublicPlans = useServerFn(listPublicCommercialPlans);

  // States for 2-step selection: Operational Plan -> Billing Cycle (Commercial Plan)
  const [selectedOpPlanId, setSelectedOpPlanId] = useState<string | null>(null);
  const [selectedCommercialPlanId, setSelectedCommercialPlanId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"redirect" | "pix">("redirect");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for PIX details
  const [pixData, setPixData] = useState<{
    qrCodeBase64?: string;
    copiaCola?: string;
    invoiceId?: string;
    expiresAt?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch available operational plans and commercial billing options
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      try {
        return await fetchPublicPlans();
      } catch {
        const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
        const res = await fetch("/api/billing/plans", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Erro ao carregar planos de assinatura");
        return res.json();
      }
    },
    enabled: open,
  });

  const commercialPlans: any[] = useMemo(() => plansData?.plans || [], [plansData]);
  const operationalPlans: any[] = useMemo(() => {
    if (plansData?.operationalPlans && plansData.operationalPlans.length > 0) {
      return plansData.operationalPlans;
    }
    // Fallback: extract unique operational plans from commercial plans JOIN data
    const map = new Map<string, any>();
    for (const c of commercialPlans) {
      const opId = c.subscription_plan_id || c.id;
      if (!map.has(opId)) {
        map.set(opId, {
          id: opId,
          name: c.subscription_plan_name || c.name,
          description: c.subscription_plan_desc || c.description,
          max_agents: c.max_agents || 1,
          max_funnels: c.max_funnels || 3,
          max_users: c.max_users || 1,
        });
      }
    }
    return Array.from(map.values());
  }, [plansData, commercialPlans]);

  // Set default Operational Plan when loaded
  useEffect(() => {
    if (operationalPlans.length > 0 && !selectedOpPlanId) {
      setSelectedOpPlanId(operationalPlans[0].id);
    }
  }, [operationalPlans, selectedOpPlanId]);

  // Filter available commercial billing cycles for selected Operational Plan
  const availableCycles = useMemo(() => {
    if (!selectedOpPlanId) return commercialPlans;
    const filtered = commercialPlans.filter(
      (c) => c.subscription_plan_id === selectedOpPlanId,
    );
    return filtered.length > 0 ? filtered : commercialPlans;
  }, [commercialPlans, selectedOpPlanId]);

  // Auto select first billing cycle option when selectedOpPlanId changes or cycles load
  useEffect(() => {
    if (availableCycles.length > 0) {
      const exists = availableCycles.some((c) => c.id === selectedCommercialPlanId);
      if (!exists) {
        setSelectedCommercialPlanId(availableCycles[0].id);
      }
    }
  }, [availableCycles, selectedCommercialPlanId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
      setPixData(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // Poll for payment completion if PIX modal is active
  useEffect(() => {
    if (!pixData?.invoiceId || !open) return;

    const interval = setInterval(async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
        const res = await fetch(`/api/billing/invoices?id=${pixData.invoiceId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.invoice?.status === "paid") {
            queryClient.invalidateQueries({ queryKey: ["license-status"] });
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            queryClient.invalidateQueries({ queryKey: ["my-plan"] });
            onOpenChange(false);
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pixData?.invoiceId, open, queryClient, onOpenChange]);

  const handleCheckout = async () => {
    if (!selectedCommercialPlanId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (paymentMethod === "redirect") {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers,
          body: JSON.stringify({ planId: selectedCommercialPlanId }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Falha ao iniciar checkout");
        }

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error("URL de checkout não retornada pelo servidor.");
        }
      } else if (paymentMethod === "pix") {
        const res = await fetch("/api/billing/checkout/pix", {
          method: "POST",
          headers,
          body: JSON.stringify({
            planId: selectedCommercialPlanId,
            payer: { email: "cliente@bliv.app" },
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Falha ao gerar código Pix");
        }

        setPixData({
          qrCodeBase64: data.qrCodeBase64,
          copiaCola: data.copiaCola || data.qrCode,
          invoiceId: data.invoiceId,
          expiresAt: data.expiresAt,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Ocorreu um erro ao processar o pagamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.copiaCola) {
      navigator.clipboard.writeText(pixData.copiaCola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl p-6 bg-card text-card-foreground shadow-2xl border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#F23869]" />
            Renovar Assinatura Bliv
          </DialogTitle>
          <DialogDescription>
            Escolha o plano desejado e a duração do ciclo de faturamento para renovar seu acesso.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {pixData ? (
          /* Telas de Pagamento PIX */
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-border bg-muted/40 p-4 flex flex-col items-center text-center space-y-3">
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 font-medium">
                PIX Gerado com Sucesso
              </Badge>
              <p className="text-xs text-muted-foreground">
                Escaneie o QR Code abaixo no app do seu banco ou utilize o código Copia e Cola.
              </p>

              {pixData.qrCodeBase64 && (
                <div className="p-2 bg-white rounded-xl shadow-md border border-zinc-200">
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="h-44 w-44 object-contain"
                  />
                </div>
              )}

              {pixData.copiaCola && (
                <div className="w-full space-y-1 text-left">
                  <Label className="text-xs text-muted-foreground">Código Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={pixData.copiaCola}
                      className="font-mono text-xs text-muted-foreground bg-background rounded-xl"
                    />
                    <Button
                      type="button"
                      onClick={handleCopyPix}
                      className="bg-brand-gradient text-white rounded-xl font-semibold shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span className="ml-1 text-xs">{copied ? "Copiado!" : "Copiar"}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                Aguardando confirmação do pagamento...
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPixData(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          /* Escolha de Plano + Duração + Forma de Pagamento */
          <div className="space-y-5 py-2">
            {/* Passo 1: Selecionar o Plano Operacional */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>1. Escolha o Plano</span>
              </Label>
              {isLoadingPlans ? (
                <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                  Carregando planos...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {operationalPlans.map((op: any) => {
                    const isSelected = selectedOpPlanId === op.id;
                    return (
                      <div
                        key={op.id}
                        onClick={() => setSelectedOpPlanId(op.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                            : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-sm text-foreground">{op.name}</span>
                            {isSelected && (
                              <Badge className="bg-brand-gradient text-white text-[9px] px-1.5 py-0 border-0">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          {op.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {op.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/40 space-y-1 text-[11px] text-muted-foreground">
                          {op.max_users != null && (
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3 w-3 text-primary shrink-0" />
                              <span>Até {op.max_users} usuários</span>
                            </div>
                          )}
                          {op.max_funnels != null && (
                            <div className="flex items-center gap-1.5">
                              <Kanban className="h-3 w-3 text-primary shrink-0" />
                              <span>Até {op.max_funnels} funis</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Passo 2: Selecionar o Período / Duração do Plano Selecionado */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                2. Escolha o Período de Duração
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableCycles.map((c: any) => {
                  const isSelected = selectedCommercialPlanId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCommercialPlanId(c.id)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                          : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-xs sm:text-sm">{c.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground block">
                          Validade: {c.duration_days || 30} dias
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm sm:text-base text-foreground block">
                          R$ {Number(c.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passo 3: Forma de Pagamento */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                3. Forma de Pagamento
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("redirect")}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    paymentMethod === "redirect"
                      ? "border-primary bg-primary/10 text-foreground font-semibold"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="text-xs">Mercado Pago / Cartão</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    paymentMethod === "pix"
                      ? "border-emerald-500 bg-emerald-500/10 text-foreground font-semibold"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <QrCode className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs">PIX Instantâneo</span>
                </button>
              </div>
            </div>

            {/* Botão Ação */}
            <div className="pt-2">
              <Button
                disabled={isSubmitting || !selectedCommercialPlanId}
                onClick={handleCheckout}
                className="w-full bg-brand-gradient text-white rounded-xl py-5 font-bold shadow-lg shadow-[#F23869]/20 transition-all hover:opacity-95 active:scale-95"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Gerando Pagamento...
                  </span>
                ) : paymentMethod === "pix" ? (
                  <span className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" /> Gerar Código Pix
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> Ir para Checkout Mercado Pago
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
