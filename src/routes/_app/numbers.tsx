import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getSalvyStatus,
  saveSalvyApiKey,
  pingSalvy,
  listSalvyAreaCodes,
  listSalvyNumbers,
  syncSalvyNumbers,
  createSalvyNumber,
  cancelSalvyNumber,
  updateSalvyNumber,
  listSalvySms,
} from "@/lib/salvy.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone, RefreshCw, ShoppingCart, X, KeyRound, CheckCircle2, ArrowLeft, CreditCard, ExternalLink, Wallet, Info, Pencil, MessageSquare, Inbox } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/password-input";

export const Route = createFileRoute("/_app/numbers")({ component: NumbersPage });

function NumbersPage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getSalvyStatus);
  const fetchNumbers = useServerFn(listSalvyNumbers);

  const status = useQuery({ queryKey: ["salvy-status"], queryFn: () => fetchStatus() });
  const numbers = useQuery({ queryKey: ["salvy-numbers"], queryFn: () => fetchNumbers() });

  const configured = status.data?.configured ?? false;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Números virtuais"
        subtitle="Compre e gerencie números virtuais via Salvy para usar no WhatsApp Business."
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <ApiKeyCard configured={configured} onChange={() => {
          qc.invalidateQueries({ queryKey: ["salvy-status"] });
          qc.invalidateQueries({ queryKey: ["salvy-numbers"] });
        }} />

        {configured && (
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Meus números</h2>
                <p className="text-sm text-muted-foreground">Lista de números virtuais ativos na sua conta Salvy.</p>
              </div>
              <div className="flex gap-2">
                <SyncButton />
                <BuyDialog />
              </div>
            </div>
            <NumbersList loading={numbers.isLoading} items={numbers.data?.numbers ?? []} />
          </Card>
        )}
      </div>
    </div>
  );
}

function ApiKeyCard({ configured, onChange }: { configured: boolean; onChange: () => void }) {
  const save = useServerFn(saveSalvyApiKey);
  const ping = useServerFn(pingSalvy);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { api_key: key.trim() } });
      toast.success("Chave da Salvy salva");
      setKey("");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const r = await ping();
      if (r.ok) toast.success("Conexão com a Salvy OK");
      else toast.error(r.error ?? "Falha ao conectar");
    } finally { setTesting(false); }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await save({ data: { api_key: null as any } });
      toast.success("Chave removida");
      onChange();
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-lg font-semibold">Chave de API da Salvy</h2>
            {configured ? (
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Configurada</Badge>
            ) : (
              <Badge variant="outline">Não configurada</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Crie sua chave em{" "}
            <a href="https://app.salvy.com.br" target="_blank" rel="noreferrer" className="underline">
              app.salvy.com.br
            </a>{" "}
            → Chaves de API. A chave fica salva apenas na sua conta.
          </p>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <Label htmlFor="salvy-key" className="sr-only">Chave</Label>
              <PasswordInput
                id="salvy-key"
                placeholder={configured ? "Cole uma nova chave para substituir" : "Cole sua chave da Salvy"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={!key.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={!configured || testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
            </Button>
            {configured && (
              <Button variant="ghost" onClick={handleRemove} disabled={saving}>
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SyncButton() {
  const qc = useQueryClient();
  const sync = useServerFn(syncSalvyNumbers);
  const m = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success(`Sincronizados ${r.upserted}/${r.total} números`);
        qc.invalidateQueries({ queryKey: ["salvy-numbers"] });
      } else toast.error(r.error ?? "Falha ao sincronizar");
    },
  });
  return (
    <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      Sincronizar
    </Button>
  );
}

// Tabela referencial de preços Salvy (Linha Virtual Móvel).
// A Salvy não expõe preços via API — esses valores são exibidos como referência
// e podem variar conforme o contrato do cliente. A cobrança real é feita pela Salvy.
const PRICING = {
  setup: 25.0,
  monthly: 29.9,
  currency: "BRL",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BuyDialog() {
  const qc = useQueryClient();
  const fetchAreas = useServerFn(listSalvyAreaCodes);
  const create = useServerFn(createSalvyNumber);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "review">("select");
  const [areaCode, setAreaCode] = useState<string>("");
  const [name, setName] = useState("");

  const areas = useQuery({
    queryKey: ["salvy-area-codes"],
    queryFn: () => fetchAreas(),
    enabled: open,
  });

  const m = useMutation({
    mutationFn: () => create({ data: { areaCode: Number(areaCode), name: name || undefined } }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success(`Número provisionado: ${r.number.phoneNumber}`);
        qc.invalidateQueries({ queryKey: ["salvy-numbers"] });
        resetAndClose();
      } else {
        toast.error(r.error ?? "Falha ao criar número");
      }
    },
  });

  const resetAndClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("select");
      setAreaCode("");
      setName("");
    }, 200);
  };

  const total = PRICING.setup + PRICING.monthly;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button><ShoppingCart className="mr-2 h-4 w-4" /> Comprar número</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Escolher número virtual</DialogTitle>
              <DialogDescription>
                Selecione o DDD desejado e dê um apelido para identificar a linha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>DDD disponível</Label>
                {areas.isLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando DDDs…
                  </div>
                ) : !areas.data?.ok ? (
                  <div className="text-sm text-destructive">{(areas.data as any)?.error ?? "Falha ao listar DDDs"}</div>
                ) : (
                  <Select value={areaCode} onValueChange={setAreaCode}>
                    <SelectTrigger><SelectValue placeholder="Selecione um DDD" /></SelectTrigger>
                    <SelectContent>
                      {areas.data.areaCodes.map((a) => (
                        <SelectItem key={a.areaCode} value={String(a.areaCode)}>
                          DDD {a.areaCode}
                        </SelectItem>
                      ))}
                      {areas.data.areaCodes.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum DDD em estoque agora.</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-name">Apelido (opcional)</Label>
                <Input id="num-name" placeholder="Ex: WhatsApp Vendas" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={resetAndClose}>Cancelar</Button>
              <Button onClick={() => setStep("review")} disabled={!areaCode}>
                Revisar pedido <ShoppingCart className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Resumo do pedido
              </DialogTitle>
              <DialogDescription>
                Confirme os detalhes antes de provisionar a linha.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Item */}
              <div className="rounded-lg border bg-card/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Linha virtual móvel</div>
                    <div className="text-xs text-muted-foreground">
                      DDD {areaCode} {name ? `· ${name}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary">1×</Badge>
                </div>
              </div>

              {/* Itens financeiros */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de ativação (única)</span>
                  <span className="font-medium">{fmtBRL(PRICING.setup)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mensalidade</span>
                  <span className="font-medium">{fmtBRL(PRICING.monthly)} <span className="text-muted-foreground font-normal">/mês</span></span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Total na ativação</span>
                  <span className="font-semibold">{fmtBRL(total)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Valores de referência. O preço final é o do seu contrato com a Salvy.
                </p>
              </div>

              {/* Método de pagamento */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <Wallet className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium flex items-center gap-2">
                      Cobrança via conta Salvy
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">automático</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O valor é debitado do saldo ou cartão cadastrado no seu painel Salvy. Nenhum cartão é processado aqui.
                    </p>
                    <a
                      href="https://app.salvy.com.br/billing"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                    >
                      <CreditCard className="h-3 w-3" />
                      Gerenciar pagamento na Salvy
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setStep("select")} disabled={m.isPending}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => m.mutate()} disabled={m.isPending}>
                {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirmar e provisionar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NumbersList({ loading, items }: { loading: boolean; items: any[] }) {
  const qc = useQueryClient();
  const cancel = useServerFn(cancelSalvyNumber);
  const m = useMutation({
    mutationFn: (v: { salvy_id: string; reason: string }) => cancel({ data: v }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("Número cancelado");
        qc.invalidateQueries({ queryKey: ["salvy-numbers"] });
      } else toast.error(r.error ?? "Falha");
    },
  });

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum número ainda. Clique em <b>Sincronizar</b> para importar os existentes ou em <b>Comprar número</b>.
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    blocked: "bg-destructive/15 text-destructive",
    canceled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Phone className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium font-mono">{n.phone_number}</div>
            <div className="text-xs text-muted-foreground truncate">
              {n.name ?? "Sem apelido"} · DDD {n.area_code ?? "?"}
            </div>
          </div>
          <Badge className={statusColor[n.status] ?? ""} variant="secondary">{n.status}</Badge>
          {n.status !== "canceled" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const reason = window.prompt(`Motivo do cancelamento de ${n.phone_number}:`, "Cancelado pelo painel");
                if (reason && reason.trim()) m.mutate({ salvy_id: n.salvy_id, reason: reason.trim() });
              }}
              disabled={m.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
