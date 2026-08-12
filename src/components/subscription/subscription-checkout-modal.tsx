import { useState, useEffect, useMemo, useRef } from "react";
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
  Calendar,
  Lock,
  ChevronDown,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicCommercialPlans } from "@/lib/billing.functions";

interface SubscriptionCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Mercado Pago SDK loader ──────────────────────────────────────────────────
function loadMercadoPagoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).MercadoPago) return resolve();
    const existing = document.getElementById("mp-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "mp-sdk";
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return { "Content-Type": "application/json" };

  let token =
    localStorage.getItem("app-token") ||
    localStorage.getItem("wapi_token") ||
    localStorage.getItem("sb-access-token") ||
    localStorage.getItem("sb-token") ||
    localStorage.getItem("token");

  if (!token) {
    const sessionStr = localStorage.getItem("app-session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        token = session?.access_token || session?.token || null;
      } catch {}
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function SubscriptionCheckoutModal({ open, onOpenChange }: SubscriptionCheckoutModalProps) {
  const queryClient = useQueryClient();
  const fetchPublicPlans = useServerFn(listPublicCommercialPlans);

  const [selectedOpPlanId, setSelectedOpPlanId] = useState<string | null>(null);
  const [selectedCommercialPlanId, setSelectedCommercialPlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PIX state
  const [pixData, setPixData] = useState<{
    qrCodeBase64?: string;
    copiaCola?: string;
    invoiceId?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Card result
  const [cardResult, setCardResult] = useState<{ status: "approved" | "rejected" | "pending"; detail?: string } | null>(null);

  // Gateway config
  const [gatewayConfig, setGatewayConfig] = useState<{
    publicKey: string;
    checkoutMode: "redirect" | "transparent";
    environment: "sandbox" | "production";
  } | null>(null);
  const mpRef = useRef<any>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [installments, setInstallments] = useState(1);
  const [detectedMethod, setDetectedMethod] = useState<{ id: string; name: string; issuer_id?: string } | null>(null);

  // Plans
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      try {
        return await fetchPublicPlans();
      } catch {
        const res = await fetch("/api/billing/plans", {
          headers: getAuthHeaders(),
          credentials: "include",
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

  useEffect(() => {
    if (operationalPlans.length > 0 && !selectedOpPlanId) {
      setSelectedOpPlanId(operationalPlans[0].id);
    }
  }, [operationalPlans, selectedOpPlanId]);

  const availableCycles = useMemo(() => {
    if (!selectedOpPlanId) return commercialPlans;
    const filtered = commercialPlans.filter((c) => c.subscription_plan_id === selectedOpPlanId);
    return filtered.length > 0 ? filtered : commercialPlans;
  }, [commercialPlans, selectedOpPlanId]);

  useEffect(() => {
    if (availableCycles.length > 0) {
      const exists = availableCycles.some((c) => c.id === selectedCommercialPlanId);
      if (!exists) setSelectedCommercialPlanId(availableCycles[0].id);
    }
  }, [availableCycles, selectedCommercialPlanId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
      setPixData(null);
      setCardResult(null);
      setIsSubmitting(false);
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      setCpf("");
      setInstallments(1);
      setDetectedMethod(null);
    }
  }, [open]);

  // Fetch gateway config when modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/billing/public-key", {
      headers: getAuthHeaders(),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setGatewayConfig(data);
        // Load SDK if transparent mode
        if (data.checkoutMode === "transparent" && data.publicKey) {
          loadMercadoPagoSdk().then(() => {
            const MP = (window as any).MercadoPago;
            if (MP && !mpRef.current) {
              mpRef.current = new MP(data.publicKey, { locale: "pt-BR" });
            }
          });
        }
      })
      .catch(() => setGatewayConfig({ publicKey: "", checkoutMode: "redirect", environment: "sandbox" }));
  }, [open]);

  // BIN detection (first 6 digits of card)
  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, "").slice(0, 6);
    if (bin.length < 6) {
      setDetectedMethod(null);
      return;
    }
    if (!gatewayConfig?.publicKey) return;
    // Query MP payment methods by BIN
    fetch(`https://api.mercadopago.com/v1/payment_methods/search?public_key=${gatewayConfig.publicKey}&bin=${bin}&locale=pt-BR`, {
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        const method = data?.results?.[0];
        if (method) {
          setDetectedMethod({
            id: method.id,
            name: method.name,
            issuer_id: method.issuer?.id,
          });
        }
      })
      .catch(() => null);
  }, [cardNumber, gatewayConfig?.publicKey]);

  // PIX poll
  useEffect(() => {
    if (!pixData?.invoiceId || !open) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/invoices?id=${pixData.invoiceId}`, {
          headers: getAuthHeaders(),
          credentials: "include",
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
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pixData?.invoiceId, open, queryClient, onOpenChange]);

  const selectedPlan = commercialPlans.find((c) => c.id === selectedCommercialPlanId);

  const handleCheckout = async () => {
    if (!selectedCommercialPlanId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const headers = getAuthHeaders();

      const isTransparent = gatewayConfig?.checkoutMode === "transparent";

      if (paymentMethod === "card") {
        if (isTransparent) {
          // ── Transparent Card Checkout ──────────────────────────────────────
          if (!mpRef.current) throw new Error("SDK do Mercado Pago não carregado. Recarregue a página.");
          if (!detectedMethod) throw new Error("Não foi possível identificar a bandeira do cartão. Verifique o número.");

          const [expiryMonth, expiryYear] = cardExpiry.split("/");
          if (!expiryMonth || !expiryYear) throw new Error("Data de validade inválida.");

          const cardTokenResult = await mpRef.current.createCardToken({
            cardNumber: cardNumber.replace(/\s/g, ""),
            cardholderName: cardName.toUpperCase().trim(),
            cardExpirationMonth: expiryMonth.trim(),
            cardExpirationYear: `20${expiryYear.trim()}`,
            securityCode: cardCvv.trim(),
            identificationType: "CPF",
            identificationNumber: cpf.replace(/\D/g, ""),
          });

          if (cardTokenResult?.error || !cardTokenResult?.id) {
            const errCause = cardTokenResult?.cause?.[0]?.description || "Erro ao tokenizar cartão";
            throw new Error(errCause);
          }

          const res = await fetch("/api/billing/checkout/card", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              planId: selectedCommercialPlanId,
              token: cardTokenResult.id,
              payment_method_id: detectedMethod.id,
              issuer_id: detectedMethod.issuer_id,
              installments,
              payer: {
                email: undefined, // backend uses logged-in user's email
                identification: { type: "CPF", number: cpf.replace(/\D/g, "") },
              },
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Falha ao processar pagamento");

          if (data.status === "approved") {
            queryClient.invalidateQueries({ queryKey: ["license-status"] });
            queryClient.invalidateQueries({ queryKey: ["billing"] });
            queryClient.invalidateQueries({ queryKey: ["my-plan"] });
            setCardResult({ status: "approved", detail: data.statusDetail || "" });
          } else {
            setCardResult({ status: data.status || "rejected", detail: data.statusDetail || "" });
          }
        } else {
          // ── Redirect / Checkout Pro ────────────────────────────────────────
          const res = await fetch("/api/billing/checkout", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ planId: selectedCommercialPlanId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Falha ao iniciar checkout");
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          } else {
            throw new Error("URL de checkout não retornada pelo servidor.");
          }
        }
      } else if (paymentMethod === "pix") {
        // ── PIX ──────────────────────────────────────────────────────────────
        const res = await fetch("/api/billing/checkout/pix", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            planId: selectedCommercialPlanId,
            payer: { email: "cliente@bliv.app" },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao gerar código Pix");
        setPixData({
          qrCodeBase64: data.qrCodeBase64,
          copiaCola: data.copiaCola || data.qrCode,
          invoiceId: data.invoiceId,
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

  const isTransparentMode = gatewayConfig?.checkoutMode === "transparent";

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

        {/* ── PIX SUCCESS ─────────────────────────────────────────────── */}
        {pixData ? (
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
                  <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code Pix" className="h-44 w-44 object-contain" />
                </div>
              )}
              {pixData.copiaCola && (
                <div className="w-full space-y-1 text-left">
                  <Label className="text-xs text-muted-foreground">Código Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={pixData.copiaCola} className="font-mono text-xs text-muted-foreground bg-background rounded-xl" />
                    <Button type="button" onClick={handleCopyPix} className="bg-brand-gradient text-white rounded-xl font-semibold shrink-0">
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
              <Button variant="ghost" size="sm" onClick={() => setPixData(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Voltar
              </Button>
            </div>
          </div>

        /* ── CARD RESULT ─────────────────────────────────────────────── */
        ) : cardResult ? (
          <div className="space-y-4 py-4 flex flex-col items-center text-center">
            {cardResult.status === "approved" ? (
              <>
                <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="font-bold text-lg text-foreground">Pagamento Aprovado!</p>
                <p className="text-sm text-muted-foreground">Sua assinatura foi ativada com sucesso.</p>
                <Button onClick={() => onOpenChange(false)} className="bg-brand-gradient text-white rounded-xl px-8">Fechar</Button>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="font-bold text-lg text-foreground">Pagamento {cardResult.status === "in_process" ? "em análise" : "Recusado"}</p>
                <p className="text-sm text-muted-foreground">
                  {cardResult.status === "in_process"
                    ? "Seu pagamento está em análise. Você será notificado em breve."
                    : `Motivo: ${cardResult.detail || "Verifique os dados do cartão e tente novamente."}`}
                </p>
                <Button variant="outline" onClick={() => setCardResult(null)} className="rounded-xl px-8">Tentar Novamente</Button>
              </>
            )}
          </div>

        /* ── MAIN FORM ───────────────────────────────────────────────── */
        ) : (
          <div className="space-y-5 py-2">

            {/* Step 1: Operational Plan */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>1. Escolha o Plano</span>
              </Label>
              {isLoadingPlans ? (
                <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">Carregando planos...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {operationalPlans.map((op: any) => {
                    const isSelected = selectedOpPlanId === op.id;
                    return (
                      <div
                        key={op.id}
                        onClick={() => setSelectedOpPlanId(op.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                          isSelected ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary" : "border-border/60 hover:border-border hover:bg-muted/30"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-sm text-foreground">{op.name}</span>
                            {isSelected && <Badge className="bg-brand-gradient text-white text-[9px] px-1.5 py-0 border-0">Ativo</Badge>}
                          </div>
                          {op.description && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{op.description}</p>}
                        </div>
                        <div className="mt-3 pt-2 border-t border-border/40 space-y-1 text-[11px] text-muted-foreground">
                          {op.max_users != null && (
                            <div className="flex items-center gap-1.5"><Users className="h-3 w-3 text-primary shrink-0" /><span>Até {op.max_users} usuários</span></div>
                          )}
                          {op.max_funnels != null && (
                            <div className="flex items-center gap-1.5"><Kanban className="h-3 w-3 text-primary shrink-0" /><span>Até {op.max_funnels} funis</span></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Billing Cycle */}
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
                        isSelected ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary" : "border-border/60 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span className="font-bold text-xs sm:text-sm">{c.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground block">Validade: {c.duration_days || 30} dias</span>
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

            {/* Step 3: Payment Method */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                3. Forma de Pagamento
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    paymentMethod === "card" ? "border-primary bg-primary/10 text-foreground font-semibold" : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="text-xs">
                    {isTransparentMode ? "Cartão de Crédito" : "Mercado Pago / Cartão"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    paymentMethod === "pix" ? "border-emerald-500 bg-emerald-500/10 text-foreground font-semibold" : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <QrCode className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs">PIX Instantâneo</span>
                </button>
              </div>
            </div>

            {/* ── Transparent Card Form ─────────────────────────────── */}
            {paymentMethod === "card" && isTransparentMode && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Pagamento seguro via Mercado Pago</span>
                  {detectedMethod && (
                    <Badge className="ml-auto text-[10px] px-2 py-0 border border-border/60 bg-background text-foreground font-medium">
                      {detectedMethod.name}
                    </Badge>
                  )}
                </div>

                {/* Card Number */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Número do Cartão</Label>
                  <Input
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className="font-mono tracking-widest rounded-xl bg-background"
                    inputMode="numeric"
                  />
                </div>

                {/* Cardholder Name */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome no Cartão</Label>
                  <Input
                    placeholder="NOME COMO NO CARTÃO"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    className="uppercase rounded-xl bg-background"
                  />
                </div>

                {/* Expiry + CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Validade (MM/AA)</Label>
                    <Input
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      inputMode="numeric"
                      className="font-mono rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CVV</Label>
                    <Input
                      placeholder="•••"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      inputMode="numeric"
                      type="password"
                      className="font-mono rounded-xl bg-background"
                    />
                  </div>
                </div>

                {/* CPF */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CPF do Titular</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={11}
                    inputMode="numeric"
                    className="font-mono rounded-xl bg-background"
                  />
                </div>

                {/* Installments */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Parcelas</Label>
                  <div className="relative">
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                        const price = selectedPlan ? Number(selectedPlan.price) / n : 0;
                        return (
                          <option key={n} value={n}>
                            {n}x de R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {n === 1 ? " (sem juros)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              <Button
                disabled={isSubmitting || !selectedCommercialPlanId}
                onClick={handleCheckout}
                className="w-full bg-brand-gradient text-white rounded-xl py-5 font-bold shadow-lg shadow-[#F23869]/20 transition-all hover:opacity-95 active:scale-95"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {paymentMethod === "pix" ? "Gerando Pix..." : "Processando pagamento..."}
                  </span>
                ) : paymentMethod === "pix" ? (
                  <span className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Gerar Código Pix</span>
                ) : isTransparentMode ? (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Pagar R$ {selectedPlan ? Number(selectedPlan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "---"}
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Ir para Checkout Mercado Pago</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
