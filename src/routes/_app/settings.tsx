import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile, rotateApiKey, pingMeta, sendTestMessage, getTestMessageStatus, sendHelloWorldTemplate, getQRCode, listQRCodes, createQRCode, updateQRCode, deleteQRCode, listOwnedWABAs, listClientWABAs, getWABAInfo, subscribeAppToWABA, listWABAPhoneNumbers, registerPhoneNumber, debugAccessToken } from "@/lib/profile.functions";
import { getCurrentUserRoles, getPlatformSettings, updatePlatformSettings, exportSchemaSql, listSchemaBackups, getSchemaBackup, createSchemaBackupNow, deleteSchemaBackup } from "@/lib/admin.functions";
import { getWebhookHealth, listWebhookEvents } from "@/lib/webhook-health.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, AlertTriangle, Check, CheckCheck, Clock, XCircle, FileText, Shield, Trash2, ShieldCheck, Lock, Monitor, Sun, Moon, Database, Download, KeyRound, Webhook, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, QrCode, Plus, Pencil, Loader2 } from "lucide-react";
import { ResultAlert } from "@/components/result-alert";
import { PasswordInput } from "@/components/password-input";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function validateDigitsField(v: string, label: string): string | null {
  if (!v) return `${label} é obrigatório.`;
  if (/\D/.test(v)) return `${label} deve conter apenas dígitos (0-9).`;
  return null;
}

/** Validação em tempo real para IDs da Meta (Phone Number ID e WABA ID). */
function validateMetaId(v: string, label: string): { error: string | null; ok: boolean } {
  if (!v) return { error: null, ok: false }; // vazio: sem erro, sem sucesso
  if (/\D/.test(v)) return { error: `Apenas números são aceitos. Remova letras, espaços ou símbolos.`, ok: false };
  if (v.length < 10) return { error: `Muito curto (${v.length} dígitos). O ${label} geralmente tem entre 15 e 17 dígitos.`, ok: false };
  if (v.length > 20) return { error: `Muito longo (${v.length} dígitos). Confira se copiou apenas o ID.`, ok: false };
  if (v.length < 14) return { error: `Está com ${v.length} dígitos — geralmente são 15 ou mais. Confira se copiou o número inteiro.`, ok: false };
  return { error: null, ok: true };
}

/** Validação em tempo real para o Access Token da Meta. */
function validateAccessToken(v: string): { error: string | null; warning: string | null; ok: boolean } {
  const t = (v ?? "").trim();
  if (!t) return { error: null, warning: null, ok: false };
  if (/\s/.test(t)) return { error: `O token não pode conter espaços ou quebras de linha. Copie de novo, todo de uma vez.`, warning: null, ok: false };
  if (!/^[A-Za-z0-9_-]+$/.test(t)) return { error: `O token tem caracteres inválidos. Use apenas letras, números, "_" e "-".`, warning: null, ok: false };
  if (!t.startsWith("EAA")) return { error: `Tokens válidos começam com "EAA". Confira se copiou o Access Token correto (não a App Secret nem outro código).`, warning: null, ok: false };
  if (t.length < 100) return { error: `Token muito curto (${t.length} caracteres). Tokens permanentes da Meta têm cerca de 200 caracteres.`, warning: null, ok: false };
  if (t.length < 150) return { error: null, warning: `Token com ${t.length} caracteres parece incompleto. Tokens permanentes costumam ter ~200. Copie tudo de novo se algo estiver faltando.`, ok: true };
  return { error: null, warning: null, ok: true };
}

function usePersistedCollapsedState(key: string, defaultValue = true) {
  const [collapsed, setCollapsed] = useState(defaultValue);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setCollapsed(JSON.parse(stored));
    }
  }, [key]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  return [collapsed, toggleCollapsed] as const;
}

function SettingsPage() {
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(updateProfile);
  const rotate = useServerFn(rotateApiKey);
  const ping = useServerFn(pingMeta);
  const sendTest = useServerFn(sendTestMessage);
  const sendHello = useServerFn(sendHelloWorldTemplate);
  const fetchStatus = useServerFn(getTestMessageStatus);
  const qc = useQueryClient();
  const fetchDebugToken = useServerFn(debugAccessToken);
  const [debugResult, setDebugResult] = useState<any>(null);

  const debugTokenMut = useMutation({
    mutationFn: (token: string) => fetchDebugToken({ data: { token } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setDebugResult(res.data);
        toast.success("Diagnóstico do token carregado!");
      } else {
        toast.error(res.error || "Não foi possível depurar o token.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDebugToken = () => {
    const token = String(form.whatsapp_access_token ?? "").trim();
    if (!token) {
      toast.error("Insira o Access Token antes de depurar.");
      return;
    }
    debugTokenMut.mutate(token);
  };

  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pingResult, setPingResult] = useState<any>(null);
  const [testTo, setTestTo] = useState("");
  const [testText, setTestText] = useState("Mensagem de teste ✅");
  const [testResult, setTestResult] = useState<any>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<{ status: string; timestamp?: string; error?: any } | null>(null);
  const pollRef = useRef<number | null>(null);

  const [crmCollapsed, toggleCrmCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_crm_collapsed",
    true
  );
  const [legalCollapsed, toggleLegalCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_legal_collapsed",
    true
  );

  useEffect(() => { if (profile) setForm(profile); }, [profile]);



  // Polling do status do teste enquanto houver wamid e ainda não chegou em "read" ou "failed"
  useEffect(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    const wamid = testResult?.wa_message_id;
    if (!wamid) return;
    const tick = async () => {
      try {
        const r = await fetchStatus({ data: { wamid } });
        if (r.found) {
          setDeliveryStatus({ status: r.status, timestamp: r.timestamp, error: r.error });
          if (r.status === "read" || r.status === "failed") {
            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch {}
    };
    tick();
    pollRef.current = window.setInterval(tick, 4000) as unknown as number;
    // Para de tentar após 2 minutos
    const stop = window.setTimeout(() => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }, 120_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      window.clearTimeout(stop);
    };
  }, [testResult?.wa_message_id, fetchStatus]);

  const saveMut = useMutation({
    mutationFn: (d: any) => save({ data: d }),
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: () => rotate(),
    onSuccess: (d) => { toast.success("Chave de API atualizada"); setForm((f: any) => ({ ...f, api_key: d.api_key })); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  const pingMut = useMutation({
    mutationFn: () => ping(),
    onSuccess: (r) => setPingResult(r),
  });

  const testMut = useMutation({
    mutationFn: (d: { to: string; text: string }) => sendTest({ data: d }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success(`Teste enviado para ${r.sent_to}`);
      else toast.error(r.error ?? "Falha ao enviar");
    },
    onError: (e: any) => { setTestResult({ ok: false, error: e.message }); toast.error(e.message); },
  });

  const helloMut = useMutation({
    mutationFn: (d: { to: string }) => sendHello({ data: d }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success(`Template hello_world enviado para ${r.sent_to}`);
      else toast.error(r.error ?? "Falha ao enviar template");
    },
    onError: (e: any) => { setTestResult({ ok: false, error: e.message }); toast.error(e.message); },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/whatsapp-webhook`;
  const ingestUrl = `${origin}/api/public/contacts/ingest`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Configurações" subtitle="Conecte sua conta do WhatsApp Business em poucos passos. Não se preocupe se nunca fez isso antes — explicamos cada campo." />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AppearanceCard />
        
        <AdminPlatformSection />

        <SetupWizard
          credentialsComplete={!!(form.whatsapp_phone_number_id && form.whatsapp_waba_id && form.whatsapp_access_token)}
          webhookComplete={!!(form.whatsapp_verify_token && form.whatsapp_app_secret)}
          testComplete={!!testResult?.ok}
        >
          {(step) => (
            <>
              {step === 0 && (


        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">1</div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Conectar sua conta do WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Preencha os 3 dados abaixo. Você encontra todos no painel da Meta em{" "}
                <strong>business.facebook.com</strong> → <strong>WhatsApp Manager</strong> → <strong>Configurações da API</strong>.
                <br />
                <span className="text-xs">Não tem ainda? Crie grátis em <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-primary underline">business.facebook.com</a>.</span>
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field
              label="ID do número de telefone"
              sublabel="(Phone Number ID)"
              digitsOnly
              value={form.whatsapp_phone_number_id}
              onChange={(v) => {
                const { error } = validateMetaId(v, "Phone Number ID");
                setErrors((e) => ({ ...e, whatsapp_phone_number_id: error }));
                setForm({ ...form, whatsapp_phone_number_id: v });
              }}
              placeholder="Ex: 106500000000000"
              hint={"⚠️ NÃO é o seu número de telefone. É um ID numérico longo (15+ dígitos) que identifica o número dentro da Meta.\n📍 Onde achar: business.facebook.com → WhatsApp Manager → Visão geral → clique no número → aparece 'ID do número de telefone'.\n👉 Use o botão de copiar ao lado do número no painel da Meta."}
              success={validateMetaId(String(form.whatsapp_phone_number_id ?? ""), "Phone Number ID").ok ? `Formato OK · ${String(form.whatsapp_phone_number_id).length} dígitos` : null}
              error={errors.whatsapp_phone_number_id}
              copyLabel="Phone Number ID"
              metaUrl="https://business.facebook.com/wa/manage/phone-numbers/"
            />
            <Field
              label="ID da conta WhatsApp Business"
              sublabel="(WABA ID)"
              digitsOnly
              value={form.whatsapp_waba_id}
              onChange={(v) => {
                const { error } = validateMetaId(v, "WABA ID");
                setErrors((e) => ({ ...e, whatsapp_waba_id: error }));
                setForm({ ...form, whatsapp_waba_id: v });
              }}
              placeholder="Ex: 112300000000000"
              hint={"⚠️ É DIFERENTE do Phone Number ID acima. Esse identifica a CONTA inteira (WABA), não um número específico.\n📍 Onde achar: business.facebook.com → Configurações da empresa → Contas → Contas do WhatsApp → clique na sua conta → 'ID da conta WhatsApp Business' no topo.\n👉 Se você colocar esse valor no campo errado, vai aparecer o erro 'Object with ID does not exist'."}
              success={validateMetaId(String(form.whatsapp_waba_id ?? ""), "WABA ID").ok ? `Formato OK · ${String(form.whatsapp_waba_id).length} dígitos` : null}
              error={errors.whatsapp_waba_id}
              copyLabel="WABA ID"
              metaUrl="https://business.facebook.com/wa/manage/account/"
            />
            <Field
              label="ID da conta de negócios (Meta Business ID)"
              sublabel="(Business ID)"
              digitsOnly
              value={form.whatsapp_business_id}
              onChange={(v) => {
                const { error } = validateMetaId(v, "Business ID");
                setErrors((e) => ({ ...e, whatsapp_business_id: error }));
                setForm({ ...form, whatsapp_business_id: v });
              }}
              placeholder="Ex: 104500000000000"
              hint={"⚠️ Identifica a sua conta de negócios inteira na Meta.\n📍 Onde achar: business.facebook.com → Configurações da empresa → Informações da empresa → 'ID do Gerenciador de Negócios' no topo."}
              success={validateMetaId(String(form.whatsapp_business_id ?? ""), "Business ID").ok ? `Formato OK · ${String(form.whatsapp_business_id).length} dígitos` : null}
              error={errors.whatsapp_business_id}
              copyLabel="Business ID"
              metaUrl="https://business.facebook.com/settings/info"
            />

            <Field
              label="Seu número de WhatsApp"
              sublabel="(só para exibição)"
              value={form.whatsapp_business_phone}
              onChange={(v) => setForm({ ...form, whatsapp_business_phone: v })}
              placeholder="5511999990000"
              hint="Com DDD e código do país. Ex.: 55 (Brasil) + 11 (DDD) + número."
            />
            <Field
              label="Velocidade de envio"
              sublabel="(mensagens por segundo)"
              type="number"
              value={form.rate_limit_per_second?.toString() ?? "20"}
              onChange={(v) => setForm({ ...form, rate_limit_per_second: Number(v) })}
              hint="Deixe 20 se não souber. Aumente só se a Meta liberou um limite maior para sua conta."
            />

            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-baseline gap-2">
                  <span>Token de acesso permanente</span>
                  <span className="text-[11px] font-normal text-muted-foreground">(Access Token de System User)</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(form.whatsapp_access_token ?? "");
                      toast.success("Access Token copiado");
                    }}
                    title="Copiar Access Token"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" asChild title="Abrir na Meta">
                    <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir na Meta
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDebugToken()}
                    disabled={debugTokenMut.isPending || !(form.whatsapp_access_token ?? "").trim()}
                    title="Verificar escopos e validade do token na Meta"
                  >
                    {debugTokenMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
                    Depurar Token
                  </Button>
                </div>
              </div>
              {(() => {
                const tokenValue = form.whatsapp_access_token ?? "";
                const v = validateAccessToken(tokenValue);
                return (
                  <>
                    <Textarea
                      rows={3}
                      value={tokenValue}
                      onChange={(e) => setForm({ ...form, whatsapp_access_token: e.target.value })}
                      placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx..."
                      className={cn(
                        "font-mono text-xs",
                        v.error && "border-destructive focus-visible:ring-destructive",
                        !v.error && v.ok && "border-success/60 focus-visible:ring-success",
                      )}
                    />
                    {v.error && (
                      <p className="flex items-start gap-1.5 text-xs text-destructive">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{v.error}</span>
                      </p>
                    )}
                    {!v.error && v.warning && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{v.warning}</span>
                      </p>
                    )}
                    {!v.error && !v.warning && v.ok && (
                      <p className="flex items-center gap-1.5 text-xs text-success">
                        <Check className="h-3.5 w-3.5" />
                        Formato OK · {tokenValue.trim().length} caracteres
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      É uma "senha" longa que começa com <code className="text-[10px]">EAA</code>. Gere em <strong>Meta Business → Configurações → Usuários do sistema</strong> — crie um usuário Admin, clique em <em>"Gerar token"</em> e marque as permissões <code className="text-[10px]">whatsapp_business_messaging</code> e <code className="text-[10px]">whatsapp_business_management</code>.
                      <br />
                      <strong className="text-foreground">Importante:</strong> escolha "nunca expira" para não ter que refazer.
                    </p>

                    {debugResult && (
                      <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-semibold text-foreground">Diagnóstico do Token (Meta API)</span>
                          <Badge variant="secondary" className={cn(debugResult.is_valid ? "bg-success/15 text-success hover:bg-success/20 border-none" : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-none")}>
                            {debugResult.is_valid ? "Válido" : "Inválido"}
                          </Badge>
                        </div>
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                          <p className="text-muted-foreground">ID do App: <span className="font-mono text-foreground font-medium">{debugResult.app_id}</span></p>
                          <p className="text-muted-foreground">Aplicação: <span className="text-foreground font-medium">{debugResult.application}</span></p>
                          <p className="text-muted-foreground">Expira em: <span className="text-foreground font-medium">{debugResult.expires_at === 0 ? "Nunca" : new Date(debugResult.expires_at * 1000).toLocaleString()}</span></p>
                          <p className="text-muted-foreground">Tipo de Usuário: <span className="text-foreground font-medium">{debugResult.type}</span></p>
                        </div>
                        {debugResult.scopes && (
                          <div className="pt-2 border-t space-y-1">
                            <p className="font-medium text-foreground">Permissões (Scopes):</p>
                            <div className="flex flex-wrap gap-1">
                              {debugResult.scopes.map((s: string) => (
                                <Badge key={s} variant="outline" className={cn(
                                  ["whatsapp_business_messaging", "whatsapp_business_management"].includes(s)
                                    ? "bg-success/10 text-success border-success/20"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => {
              const nextErrors: Record<string, string | null> = {};
              const err1 = validateDigitsField(String(form.whatsapp_phone_number_id ?? ""), "ID do número de telefone");
              if (err1) nextErrors.whatsapp_phone_number_id = err1;
              const err2 = validateDigitsField(String(form.whatsapp_waba_id ?? ""), "ID da conta WhatsApp Business");
              if (err2) nextErrors.whatsapp_waba_id = err2;
              setErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                toast.error("Corrija os erros antes de salvar.");
                return;
              }
              saveMut.mutate({
                whatsapp_phone_number_id: form.whatsapp_phone_number_id,
                whatsapp_waba_id: form.whatsapp_waba_id,
                whatsapp_business_id: form.whatsapp_business_id,
                whatsapp_business_phone: form.whatsapp_business_phone,
                whatsapp_access_token: form.whatsapp_access_token,
                rate_limit_per_second: form.rate_limit_per_second,
              });
            }} disabled={saveMut.isPending}>Salvar e conectar</Button>
            <Button variant="outline" onClick={() => {
              // Pré-validação: identifica EXATAMENTE quais campos faltam ou estão inválidos
              const checks: { key: string; label: string; problem: string | null }[] = [];
              const phoneId = String(form.whatsapp_phone_number_id ?? "").trim();
              const wabaId = String(form.whatsapp_waba_id ?? "").trim();
              const token = String(form.whatsapp_access_token ?? "").trim();

              checks.push({
                key: "whatsapp_phone_number_id",
                label: "ID do número de telefone",
                problem: !phoneId ? "está vazio" : validateDigitsField(phoneId, "ID do número de telefone"),
              });
              checks.push({
                key: "whatsapp_waba_id",
                label: "ID da conta WhatsApp Business (WABA ID)",
                problem: !wabaId ? "está vazio" : validateDigitsField(wabaId, "ID da conta WhatsApp Business"),
              });
              const tokenCheck = validateAccessToken(token);
              checks.push({
                key: "whatsapp_access_token",
                label: "Token de acesso permanente",
                problem: !token ? "está vazio" : (tokenCheck.error ?? null),
              });

              const missing = checks.filter((c) => c.problem);
              if (missing.length > 0) {
                const nextErrors: Record<string, string | null> = { ...errors };
                missing.forEach((m) => { nextErrors[m.key] = m.problem!; });
                setErrors(nextErrors);
                setPingResult({
                  ok: false,
                  error: missing.length === 1
                    ? `Falta preencher: ${missing[0].label}.`
                    : `Faltam ${missing.length} campos para testar a conexão.`,
                  missingFields: missing.map((m) => ({ label: m.label, problem: m.problem })),
                });
                toast.error(missing.length === 1
                  ? `Preencha: ${missing[0].label}`
                  : `${missing.length} campos pendentes`);
                return;
              }
              setPingResult(null);
              pingMut.mutate();
            }} disabled={pingMut.isPending}>
              {pingMut.isPending ? "Testando…" : "Testar agora"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            💡 Clique em <strong>"Testar agora"</strong> depois de salvar — vamos verificar a conexão e dizer exatamente o que está faltando, se faltar algo.
          </p>
          {pingResult && (
            <ResultAlert
              ok={!!pingResult.ok}
              successContent={
                <span>Tudo certo! Conectado a <strong>{pingResult.info?.verified_name}</strong> ({pingResult.info?.display_phone_number}) · qualidade do número: {pingResult.info?.quality_rating}</span>
              }
              error={pingResult.error}
              details={
                pingResult.missingFields ? (
                  <div className="space-y-1">
                    <p className="font-medium">Campos com problema:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {pingResult.missingFields.map((f: any, i: number) => (
                        <li key={i}><strong>{f.label}</strong> — {f.problem}</li>
                      ))}
                    </ul>
                  </div>
                ) : (pingResult.details ?? pingResult.error)
              }
              fallback="Não conseguimos conectar. Confira se os dados acima foram copiados corretamente."
            />
          )}
        </Card>
              )}

              {step === 2 && (
        <Card className="p-6">

          <h2 className="font-display text-lg font-semibold">Enviar mensagem de teste</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envia uma mensagem de texto simples direto pela WhatsApp Cloud API.
          </p>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm dark:border-amber-400/30 dark:bg-amber-400/10">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">A API pode aceitar e mesmo assim a mensagem não chegar.</p>
              <p className="text-amber-900/80 dark:text-amber-200/80">
                Para mensagens de <strong>texto livre</strong> (como este teste), o destinatário precisa ter te enviado uma mensagem nas <strong>últimas 24h</strong>. Fora dessa janela, a Meta confirma o recebimento (retorna um <code className="text-xs">wamid</code>) mas <strong>não entrega</strong>.
              </p>
              <p className="text-amber-900/80 dark:text-amber-200/80">
                Se sua conta WhatsApp Business ainda está em modo de teste/desenvolvimento, o número também precisa estar cadastrado em <em>WhatsApp Manager → Phone Numbers → Test recipients</em>. Para envios fora da janela, use um <strong>template aprovado</strong>.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr,2fr]">
            <div className="space-y-1.5">
              <Label>Destinatário (E.164 sem +)</Label>
              <p className="text-[11px] text-muted-foreground">Exemplo: 5511999999999</p>
              <Input
                value={testTo}
                onChange={(e) => setTestTo(onlyDigits(e.target.value))}
                placeholder="5511999999999"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Mensagem de teste"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (testTo.length < 8) { toast.error("Informe um número válido (apenas dígitos)."); return; }
                if (!testText.trim()) { toast.error("Escreva a mensagem."); return; }
                setTestResult(null);
                setDeliveryStatus(null);
                testMut.mutate({ to: testTo, text: testText.trim() });
              }}
              disabled={testMut.isPending || helloMut.isPending}
            >
              {testMut.isPending ? "Enviando…" : "Enviar texto livre"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (testTo.length < 8) { toast.error("Informe um número válido (apenas dígitos)."); return; }
                setTestResult(null);
                setDeliveryStatus(null);
                helloMut.mutate({ to: testTo });
              }}
              disabled={testMut.isPending || helloMut.isPending}
              title="Template pré-aprovado pela Meta — funciona fora da janela de 24h"
            >
              {helloMut.isPending ? "Enviando…" : "Enviar template hello_world"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            💡 <strong>Não chegou nada?</strong> Use o <strong>hello_world</strong> — é um template oficial da Meta que ignora a janela de 24h. Se esse chegar e o texto livre não, é confirmação de que o problema é a janela.
          </p>

          {testResult && (
            <>
              <ResultAlert
                ok={!!testResult.ok}
                successContent={
                  <span>Aceito pela Meta para <strong>{testResult.sent_to}</strong>{testResult.wa_message_id ? <> · id <code className="text-xs">{testResult.wa_message_id}</code></> : null}</span>
                }
                error={testResult.error}
                details={testResult.details}
                fallback="Falha ao enviar a mensagem de teste."
              />
              {testResult.ok && (
                <DeliveryTimeline status={deliveryStatus} hasWebhook={!!form.whatsapp_app_secret && !!form.whatsapp_verify_token} />
              )}
            </>
          )}
        </Card>
              )}

              {step === 1 && (
        <Card className="p-6">

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">2</div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Receber confirmações da Meta (webhook)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Isso permite saber quando suas mensagens foram <strong>entregues e lidas</strong>. No painel da Meta, vá em{" "}
                <strong>App Dashboard → WhatsApp → Configuration</strong> e cole os dados abaixo. Marque a opção <code className="text-xs">messages</code>.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <ReadOnly label="1. Cole esta URL no campo 'Callback URL' da Meta" value={webhookUrl} onCopy={() => copy(webhookUrl, "URL do webhook")} />
            <div className="space-y-1.5">
              <Label className="flex items-baseline gap-2">
                <span>2. Crie uma palavra secreta</span>
                <span className="text-[11px] font-normal text-muted-foreground">(Verify Token)</span>
              </Label>
              <div className="flex gap-2">
                <Input value={form.whatsapp_verify_token ?? ""} onChange={(e) => setForm({ ...form, whatsapp_verify_token: e.target.value })} placeholder="ex: meu_token_super_secreto_123" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(form.whatsapp_verify_token ?? ""); toast.success("Verify Token copiado"); }} title="Copiar Verify Token">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button onClick={() => saveMut.mutate({ whatsapp_verify_token: form.whatsapp_verify_token })}>Salvar</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Pode ser qualquer texto que só você sabe. Depois cole o <strong>mesmo valor</strong> no campo "Verify token" da Meta.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-baseline gap-2">
                <span>3. Cole a Chave Secreta do App</span>
                <span className="text-[11px] font-normal text-muted-foreground">(App Secret)</span>
              </Label>
              <div className="flex gap-2">
                <Input type="password" value={form.whatsapp_app_secret ?? ""} onChange={(e) => setForm({ ...form, whatsapp_app_secret: e.target.value })} placeholder="Cole aqui o App Secret" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(form.whatsapp_app_secret ?? ""); toast.success("App Secret copiado"); }} title="Copiar App Secret">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild title="Abrir na Meta">
                  <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button onClick={() => saveMut.mutate({ whatsapp_app_secret: form.whatsapp_app_secret })}>Salvar</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">No painel da Meta: <strong>Configurações → Básico → Chave Secreta do App</strong>. Usado para confirmar que cada aviso veio mesmo da Meta.</p>
            </div>
          </div>
        </Card>
              )}
            </>
          )}
        </SetupWizard>

        <WebhookHealthCard />




        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Conectar com outros sistemas (CRM, automações)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use a chave abaixo para receber contatos automaticamente do seu CRM (HubSpot, RD Station, n8n, Zapier, etc).
                Se nunca usou isso, pode ignorar esta seção — não é obrigatório para enviar mensagens.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleCrmCollapsed}
              aria-expanded={!crmCollapsed}
              aria-label={crmCollapsed ? "Expandir seção" : "Recolher seção"}
              className="shrink-0 gap-1"
            >
              {crmCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">{crmCollapsed ? "Expandir" : "Recolher"}</span>
            </Button>
          </div>
          {!crmCollapsed && (
            <div className="mt-4 space-y-3">
              <ReadOnly label="Endereço para envio (POST)" value={ingestUrl} onCopy={() => copy(ingestUrl, "Endpoint")} />
              <div className="space-y-1.5">
                <Label>Sua chave de acesso</Label>
                <div className="flex gap-2">
                  <Input readOnly value={form.api_key ?? ""} className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copy(form.api_key ?? "", "API key")} title="Copiar"><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => rotateMut.mutate()} disabled={rotateMut.isPending} title="Gerar nova chave (a antiga deixa de funcionar)">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Trate como uma senha — qualquer pessoa com essa chave pode enviar contatos para sua conta.</p>
              </div>
              <details className="rounded-md border bg-muted/30 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-foreground">Exemplo técnico para desenvolvedores</summary>
                <pre className="mt-3 overflow-auto rounded-md bg-sidebar p-3 text-xs text-sidebar-foreground">
{`curl -X POST ${ingestUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${form.api_key ?? "SUA_API_KEY"}" \\
  -d '{
    "phone": "+5511999990000",
    "name": "João",
    "email": "joao@empresa.com",
    "custom_fields": {"empresa": "Acme"},
    "tags": ["lead-quente"]
  }'`}
                </pre>
              </details>
            </div>
          )}
        </Card>

        <QRCodeSection />

        <WABASection />

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Documentos legais</h2>
              <p className="mt-1 text-sm text-muted-foreground">Leia nossos termos e saiba como seus dados são tratados.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleLegalCollapsed}
              aria-expanded={!legalCollapsed}
              aria-label={legalCollapsed ? "Expandir seção" : "Recolher seção"}
              className="shrink-0 gap-1"
            >
              {legalCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">{legalCollapsed ? "Expandir" : "Recolher"}</span>
            </Button>
          </div>
          {!legalCollapsed && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link to="/privacy" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
                <Shield className="h-4 w-4 text-primary" />
                Política de Privacidade
              </Link>
              <Link to="/terms" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
                <FileText className="h-4 w-4 text-primary" />
                Termos de Serviço
              </Link>
              <Link to="/data-deletion" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
                <Trash2 className="h-4 w-4 text-primary" />
                Exclusão de Dados
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SetupWizard({
  credentialsComplete,
  webhookComplete,
  testComplete,
  children,
}: {
  credentialsComplete: boolean;
  webhookComplete: boolean;
  testComplete: boolean;
  children: (step: number) => React.ReactNode;
}) {
  const steps = useMemo(
    () => [
      { label: "Credenciais", icon: KeyRound, done: credentialsComplete },
      { label: "Webhook", icon: Webhook, done: webhookComplete },
      { label: "Teste", icon: Send, done: testComplete },
    ],
    [credentialsComplete, webhookComplete, testComplete],
  );
  const [step, setStep] = useState(0);
  const isComplete = credentialsComplete && webhookComplete && testComplete;
  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_setup_wizard_collapsed",
    isComplete
  );
  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/30 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Assistente de configuração</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapa {step + 1} de {steps.length} · {doneCount} de {steps.length} concluída(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{progress}%</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expandir seção" : "Recolher seção"}
              className="shrink-0 gap-1"
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
            </Button>
          </div>
        </div>
        <Progress value={progress} className="mt-4" />

        {!collapsed && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  active ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    s.done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wide opacity-70">Etapa {i + 1}</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {!collapsed && (
      <>
      <div className="p-2 md:p-4">{children(step)}</div>

      <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        <span className="text-xs text-muted-foreground">
          {steps[step].done ? "Etapa concluída ✓" : "Preencha os campos desta etapa"}
        </span>
        <Button size="sm" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}>
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      </>
      )}
    </Card>
  );
}

function AppearanceCard() {
  const { theme, isSystem, resetTheme, setTheme } = useTheme();
  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_appearance_collapsed",
    true
  );

  const handleReset = () => {
    resetTheme();
    toast.success("Tema sincronizado com a preferência do sistema");
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Aparência</h2>
          <p className="mt-1 text-sm text-muted-foreground">Personalize o tema do painel. A mudança é aplicada imediatamente.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir seção" : "Recolher seção"}
          className="shrink-0 gap-1"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
        </Button>
      </div>
      {!collapsed && (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${isSystem ? "bg-primary/10" : "bg-muted"}`}>
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Tema atual: <span className="capitalize">{theme === "dark" ? "Escuro" : "Claro"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isSystem ? "Seguindo a preferência do sistema" : "Definido manualmente"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={!isSystem && theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
          >
            <Sun className="mr-2 h-4 w-4" />
            Claro
          </Button>
          <Button
            variant={!isSystem && theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
          >
            <Moon className="mr-2 h-4 w-4" />
            Escuro
          </Button>
          <Button
            variant={isSystem ? "default" : "outline"}
            size="sm"
            onClick={handleReset}
            title="Usar a preferência do sistema (claro/escuro)"
          >
            <Monitor className="mr-2 h-4 w-4" />
            Sistema
          </Button>
        </div>
      </div>
      )}
    </Card>
  );
}

function DeliveryTimeline({ status, hasWebhook }: { status: { status: string; timestamp?: string; error?: any } | null; hasWebhook: boolean }) {
  if (!hasWebhook) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Para acompanhar <strong>entregue / lido</strong> em tempo real, configure abaixo o <strong>App Secret</strong> + <strong>Verify Token</strong> e cadastre a Callback URL no painel da Meta (campo <code>messages</code>).
        </span>
      </div>
    );
  }

  const order = ["sent", "delivered", "read"] as const;
  const current = status?.status;
  const failed = current === "failed";
  const reachedIdx = current ? order.indexOf(current as any) : -1;

  return (
    <div className="mt-2 rounded-md border bg-muted/20 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Status real (via webhook da Meta)</div>
      {failed ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Falhou na entrega</div>
            {status?.error && (
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(status.error, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm">
          <Step label="Enviado" active={reachedIdx >= 0} icon={Check} />
          <Divider active={reachedIdx >= 1} />
          <Step label="Entregue" active={reachedIdx >= 1} icon={CheckCheck} />
          <Divider active={reachedIdx >= 2} />
          <Step label="Lido" active={reachedIdx >= 2} icon={CheckCheck} accent />
          {reachedIdx < 1 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 animate-pulse" /> aguardando confirmação da Meta…
            </span>
          )}
        </div>
      )}
      {status?.timestamp && (
        <div className="mt-2 text-[11px] text-muted-foreground">Última atualização: {new Date(status.timestamp).toLocaleString()}</div>
      )}
    </div>
  );
}

function Step({ label, active, icon: Icon, accent }: { label: string; active: boolean; icon: any; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? (accent ? "text-primary" : "text-success") : "text-muted-foreground/50"}`}>
      <Icon className="h-4 w-4" />
      <span className={active ? "font-medium" : ""}>{label}</span>
    </div>
  );
}

function Divider({ active }: { active: boolean }) {
  return <div className={`h-px w-6 ${active ? "bg-success" : "bg-border"}`} />;
}

function Field({ label, sublabel, hint, value, onChange, type = "text", placeholder, digitsOnly, error, success, metaUrl, copyLabel }: { label: string; sublabel?: string; hint?: React.ReactNode; value: any; onChange: (v: string) => void; type?: string; placeholder?: string; digitsOnly?: boolean; error?: string | null; success?: string | null; metaUrl?: string; copyLabel?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline gap-2">
        <span>{label}</span>
        {sublabel && <span className="text-[11px] font-normal text-muted-foreground">{sublabel}</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(digitsOnly ? onlyDigits(e.target.value) : e.target.value)}
          placeholder={placeholder}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive",
            !error && success && "border-success/60 focus-visible:ring-success",
          )}
          inputMode={digitsOnly ? "numeric" : undefined}
          pattern={digitsOnly ? "[0-9]*" : undefined}
        />
        {copyLabel && (
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(String(value ?? "")); toast.success(`${copyLabel} copiado`); }} title={`Copiar ${copyLabel}`}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {metaUrl && (
          <Button variant="outline" size="icon" asChild title="Abrir na Meta">
            <a href={metaUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {!error && success && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" />
          {success}
        </p>
      )}
      {hint && !error && !success && <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

function ReadOnly({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button variant="outline" onClick={onCopy}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function AdminPlatformSection() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const fetchSettings = useServerFn(getPlatformSettings);
  const saveSettings = useServerFn(updatePlatformSettings);
  const qc = useQueryClient();

  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const isAdmin = roleData?.isAdmin === true;

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fetchSettings(),
    enabled: isAdmin,
  });

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [configId, setConfigId] = useState("");
  const [graphVersion, setGraphVersion] = useState("v20.0");
  const [headTags, setHeadTags] = useState("");
  const [bodyTags, setBodyTags] = useState("");
  const [cronSecret, setCronSecret] = useState("");
  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_admin_platform_collapsed",
    true
  );
  const [tagsCollapsed, toggleTagsCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_custom_tags_collapsed",
    true
  );
  const [cronCollapsed, toggleCronCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_cron_secret_collapsed",
    true
  );
  const [credsCollapsed, toggleCredsCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_meta_creds_collapsed",
    true
  );

  useEffect(() => {
    if (settings) {
      setAppId(settings.meta_app_id ?? "");
      setConfigId(settings.meta_config_id ?? "");
      setGraphVersion(settings.meta_graph_version ?? "v20.0");
      setHeadTags((settings as any).head_tags ?? "");
      setBodyTags((settings as any).body_tags ?? "");
      setCronSecret((settings as any).cron_secret ?? "");
      setAppSecret("");
    }
  }, [settings]);

  const mut = useMutation({
    mutationFn: (data: any) => saveSettings({ data }),
    onSuccess: () => {
      toast.success("Configurações da plataforma salvas.");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      setAppSecret("");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  if (!isAdmin) return null;

  return (
    <Card className="p-6 border-primary/30">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-lg font-semibold">Plataforma Meta (Tech Provider / ISV)</h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Lock className="h-3 w-3" /> Admin Master
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Credenciais globais do <strong>seu</strong> App Meta. Compartilhadas por toda a plataforma — habilitam o botão "Conectar com o Facebook" (Embedded Signup) para todos os clientes.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir seção" : "Recolher seção"}
          className="shrink-0 gap-1"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
        </Button>
      </div>

      {!collapsed && (
      <>
      <div className="mt-5 border-t pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">Credenciais de API</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Configurações de chaves e identificadores da sua conta de desenvolvedor Meta.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCredsCollapsed}
            aria-expanded={!credsCollapsed}
            aria-label={credsCollapsed ? "Expandir credenciais" : "Recolher credenciais"}
            className="shrink-0 gap-1 mt-0.5"
          >
            {credsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{credsCollapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>

        {!credsCollapsed && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Meta App ID</Label>
              <Input
                value={appId}
                onChange={(e) => setAppId(onlyDigits(e.target.value))}
                placeholder="Ex: 1234567890123456"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">{"📍 developers.facebook.com → Meus Apps → selecione o App → o número aparece no topo da página, abaixo do nome do App (\"ID do aplicativo\").\n⚠️ Não confunda com o Business ID nem com o WABA ID."}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Embedded Signup Config ID</Label>
              <Input
                value={configId}
                onChange={(e) => setConfigId(onlyDigits(e.target.value))}
                placeholder="Ex: 9876543210987654"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">{"📍 developers.facebook.com → seu App → WhatsApp → Configuração → role até 'Registro incorporado' (Embedded Signup) → 'Configurações' → copie o ID da configuração.\n💡 É o ID do fluxo de onboarding que abre quando o cliente clica em 'Conectar com o Facebook'."}</p>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label>App Secret</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <PasswordInput
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder={settings?.meta_app_secret_set ? "•••••••••••••••• (já configurado — deixe vazio para manter)" : "Cole aqui o App Secret"}
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!appSecret}
                  onClick={() => {
                    navigator.clipboard.writeText(appSecret);
                    toast.success("App Secret copiado");
                  }}
                  title="Copiar App Secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  disabled={!appSecret || mut.isPending}
                  onClick={() => mut.mutate({ meta_app_secret: appSecret })}
                >
                  {mut.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
              <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
                {"📍 developers.facebook.com → seu App → Configurações → Básico → campo 'Chave Secreta do App' → clique em 'Mostrar' (vai pedir sua senha do Facebook).\n🔒 Usado para validar a assinatura dos webhooks da Meta. Nunca compartilhe esse valor."}
                {settings?.meta_app_secret_set && <span className="block mt-1 text-success font-medium">✓ Atualmente configurado</span>}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Graph API Version</Label>
              <Select value={graphVersion || "v20.0"} onValueChange={setGraphVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a versão" />
                </SelectTrigger>
                <SelectContent>
                  {["v23.0", "v22.0", "v21.0", "v20.0", "v19.0", "v18.0", "v17.0"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <p className="text-[11px] text-muted-foreground">
                {settings?.updated_at && <>Última atualização: {new Date(settings.updated_at).toLocaleString()}</>}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">Tags personalizadas (Analytics, Pixel, etc.)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cole snippets completos (com <code className="text-xs">&lt;script&gt;</code>, <code className="text-xs">&lt;meta&gt;</code>, <code className="text-xs">&lt;noscript&gt;</code>…). Eles serão injetados em <strong>todas as páginas</strong> da plataforma para todos os usuários.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTagsCollapsed}
            aria-expanded={!tagsCollapsed}
            aria-label={tagsCollapsed ? "Expandir tags" : "Recolher tags"}
            className="shrink-0 gap-1 mt-0.5"
          >
            {tagsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{tagsCollapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>

        {!tagsCollapsed && (
          <div className="mt-4 grid gap-4">
            <div className="space-y-1.5">
              <Label>Tags no &lt;head&gt;</Label>
              <Textarea
                rows={6}
                value={headTags}
                onChange={(e) => setHeadTags(e.target.value)}
                placeholder={`<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXX');</script>`}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Ideal para Google Analytics, GTM, Meta Pixel, verificações de domínio, etc.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tags no final do &lt;body&gt;</Label>
              <Textarea
                rows={6}
                value={bodyTags}
                onChange={(e) => setBodyTags(e.target.value)}
                placeholder={`<!-- Chat / widgets -->\n<script src="https://widget.exemplo.com/loader.js"></script>`}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Ideal para widgets, scripts que dependem do DOM carregado, fallbacks &lt;noscript&gt;.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">Segredo do Cron (CRON_SECRET)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Token usado para autenticar o agendador (pg_cron) ao chamar{" "}
              <code className="text-xs">/api/public/cron/process-queue</code>. Se vazio, o endpoint fica <strong>aberto</strong> (apenas para testes).
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCronCollapsed}
            aria-expanded={!cronCollapsed}
            aria-label={cronCollapsed ? "Expandir cron" : "Recolher cron"}
            className="shrink-0 gap-1 mt-0.5"
          >
            {cronCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{cronCollapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>

        {!cronCollapsed && (
          <>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={cronSecret}
                onChange={(e) => setCronSecret(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
                placeholder="Clique em Gerar ou cole um token"
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const bytes = new Uint8Array(32);
                    crypto.getRandomValues(bytes);
                    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
                    setCronSecret(token);
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> Gerar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!cronSecret}
                  onClick={() => { navigator.clipboard.writeText(cronSecret); toast.success("Copiado!"); }}
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Após salvar, envie este valor no header <code className="text-[10px]">x-cron-secret</code> em cada chamada do cron.
            </p>
          </>
        )}
      </div>

      <div className="mt-6 border-t pt-5">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4" /> Backups do schema do banco
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Um backup automático do schema <code className="text-xs">public</code> é gerado diariamente às 03:00 (UTC).
          Você também pode gerar um backup manual a qualquer momento. As 30 versões mais recentes ficam disponíveis para download.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ExportSchemaButton />
        </div>
        <SchemaBackupsHistory />
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() =>
            mut.mutate({
              meta_app_id: appId || undefined,
              meta_app_secret: appSecret || undefined,
              meta_config_id: configId || undefined,
              meta_graph_version: graphVersion || undefined,
              head_tags: headTags,
              body_tags: bodyTags,
              cron_secret: cronSecret,
            })
          }
          disabled={mut.isPending}
        >
          {mut.isPending ? "Salvando…" : "Salvar configurações da plataforma"}
        </Button>
      </div>

      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">⚠️ Pré-requisitos na Meta:</p>
        <p>• Empresa verificada no Business Manager (CNPJ)</p>
        <p>• App em modo <strong>Live</strong> (não Development)</p>
        <p>
          • Permissões <code className="text-[10px]">whatsapp_business_management</code> +{" "}
          <code className="text-[10px]">whatsapp_business_messaging</code> com acesso avançado
        </p>
      </div>
      </>
      )}
    </Card>
  );
}


function WebhookHealthCard() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const fetchHealth = useServerFn(getWebhookHealth);

  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const isAdmin = roleData?.isAdmin === true;

  const { data: health, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["webhook-health"],
    queryFn: () => fetchHealth(),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_webhook_health_collapsed",
    true
  );

  if (!isAdmin) return null;

  const last = health?.last_received_at ? new Date(health.last_received_at) : null;
  const ageMs = last ? Date.now() - last.getTime() : null;
  const fresh = ageMs !== null && ageMs < 24 * 60 * 60 * 1000;
  const stale = ageMs !== null && ageMs >= 24 * 60 * 60 * 1000;
  const never = !last;

  const statusColor = fresh
    ? "bg-success/15 text-success border-success/30"
    : stale
    ? "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400"
    : "bg-destructive/15 text-destructive border-destructive/30";

  const statusLabel = fresh ? "Recebendo eventos" : stale ? "Sem eventos há +24h" : "Nunca recebeu eventos";

  const formatAge = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s atrás`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h atrás`;
    const d = Math.floor(h / 24);
    return `${d} dia(s) atrás`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Saúde do webhook</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitora se a Meta está conseguindo entregar eventos no seu endpoint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EventsDialogButton />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir seção" : "Recolher seção"}
            className="shrink-0 gap-1"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>
      </div>

      {!collapsed && (
      <>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
            <div className={cn("mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm font-medium", statusColor)}>
              <span className={cn("h-2 w-2 rounded-full", fresh ? "bg-success animate-pulse" : stale ? "bg-amber-500" : "bg-destructive")} />
              {statusLabel}
            </div>
            {last && (
              <div className="mt-2 text-xs text-muted-foreground">
                Último em {last.toLocaleString()} ({formatAge(ageMs!)})
              </div>
            )}
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Últimas 24h</div>
            <div className="mt-2 text-2xl font-semibold">{health?.events_last_24h ?? 0}</div>
            <div className="text-xs text-muted-foreground">eventos recebidos</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pendentes</div>
            <div className="mt-2 text-2xl font-semibold">{health?.unprocessed_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">eventos não processados</div>
          </div>
        </div>
      )}

      {never && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          ⚠️ Nenhum evento foi recebido ainda. Verifique se a Callback URL e o Verify Token estão configurados na Meta e se o webhook foi inscrito no campo <code>messages</code>.
        </div>
      )}
      </>
      )}
    </Card>
  );
}

function EventsDialogButton() {
  const [open, setOpen] = useState(false);
  const [onlyUnprocessed, setOnlyUnprocessed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const fetchEvents = useServerFn(listWebhookEvents);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["webhook-events", onlyUnprocessed],
    queryFn: () => fetchEvents({ data: { limit: 50, onlyUnprocessed } }),
    enabled: open,
  });

  const events = data?.events ?? [];

  function summarize(raw: any): string {
    try {
      const entry = raw?.entry?.[0];
      const change = entry?.changes?.[0];
      const field = change?.field;
      const value = change?.value;
      if (value?.messages?.length) {
        const m = value.messages[0];
        const from = m.from ?? "?";
        const type = m.type ?? "msg";
        const text = m.text?.body ? `: "${String(m.text.body).slice(0, 60)}"` : "";
        return `📩 mensagem (${type}) de ${from}${text}`;
      }
      if (value?.statuses?.length) {
        const s = value.statuses[0];
        return `✅ status "${s.status}" → ${s.recipient_id ?? "?"}`;
      }
      return field ? `evento: ${field}` : "evento";
    } catch {
      return "evento";
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1" />
        Ver eventos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Eventos do webhook</DialogTitle>
            <DialogDescription>
              Últimos {events.length} eventos recebidos da Meta. Clique para ver o payload completo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b pb-3">
            <Button
              variant={onlyUnprocessed ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyUnprocessed((v) => !v)}
            >
              {onlyUnprocessed ? "Mostrando pendentes" : "Apenas pendentes"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">{events.length} eventos</span>
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum evento {onlyUnprocessed ? "pendente" : "encontrado"}.
              </p>
            ) : (
              <ul className="divide-y">
                {events.map((ev: any) => {
                  const isOpen = expanded === ev.id;
                  return (
                    <li key={ev.id} className="py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : ev.id)}
                        className="flex w-full items-start gap-3 text-left hover:bg-muted/50 rounded-md p-2 -m-2"
                      >
                        <Badge variant={ev.processed ? "secondary" : "outline"} className="mt-0.5 shrink-0">
                          {ev.processed ? "processado" : "pendente"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{summarize(ev.raw)}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(ev.received_at).toLocaleString()} • {ev.source}
                          </div>
                        </div>
                      </button>
                      {isOpen && (
                        <pre className="mt-2 max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                          {JSON.stringify(ev.raw, null, 2)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function ExportSchemaButton() {
  const run = useServerFn(exportSchemaSql);
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await run();
      const blob = new Blob([res.sql], { type: "application/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `schema-public-${ts}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Schema exportado com sucesso");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar schema");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndpoint() {
    setLoading(true);
    try {
      const { db } = await import("@/integrations/mysql/client");
      const { data: sessionData } = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada — faça login novamente.");

      const resp = await fetch("/api/admin/schema-dump", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        throw new Error(`Falha (${resp.status}) ao chamar o endpoint`);
      }
      const blob = await resp.blob();
      const cd = resp.headers.get("content-disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(cd);
      const filename =
        m?.[1] ??
        `schema-public-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.sql`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no endpoint");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={handleExport} disabled={loading}>
        <Download className="h-4 w-4" />
        {loading ? "Gerando…" : "Baixar schema.sql"}
      </Button>
      <Button type="button" variant="ghost" onClick={handleEndpoint} disabled={loading}>
        <Download className="h-4 w-4" />
        Via endpoint /api/admin/schema-dump
      </Button>
    </>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function SchemaBackupsHistory() {
  const list = useServerFn(listSchemaBackups);
  const get = useServerFn(getSchemaBackup);
  const createNow = useServerFn(createSchemaBackupNow);
  const del = useServerFn(deleteSchemaBackup);
  const qc = useQueryClient();

  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_schema_backups_collapsed",
    false
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["schema-backups"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: () => createNow(),
    onSuccess: () => {
      toast.success("Backup gerado");
      qc.invalidateQueries({ queryKey: ["schema-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar backup"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Backup excluído");
      qc.invalidateQueries({ queryKey: ["schema-backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });

  async function downloadBackup(id: string, createdAt: string) {
    try {
      const row = await get({ data: { id } });
      const blob = new Blob([row.sql], { type: "application/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date(createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `schema-backup-${ts}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao baixar backup");
    }
  }

  const backups = data?.backups ?? [];
  const totalPages = Math.ceil(backups.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [totalPages, currentPage]);

  const paginatedBackups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return backups.slice(start, start + itemsPerPage);
  }, [backups, currentPage]);

  return (
    <div className="mt-4 rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Histórico de versões</div>
          {backups.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {backups.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", createMut.isPending && "animate-spin")} />
            {createMut.isPending ? "Gerando…" : "Gerar backup agora"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir histórico" : "Recolher histórico"}
            className="shrink-0 h-8 w-8 p-0"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Carregando…</div>
          ) : backups.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhum backup ainda. O primeiro será gerado automaticamente às 03:00 (UTC), ou clique em "Gerar backup agora".
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {paginatedBackups.map((b: any) => (
                  <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {b.source === "manual" ? "Manual" : "Automático"} · {formatBytes(b.size_bytes)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadBackup(b.id, b.created_at)}
                      >
                        <Download className="h-3.5 w-3.5" /> Baixar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir este backup?")) delMut.mutate(b.id);
                        }}
                        disabled={delMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-3 py-2 bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages} ({backups.length} itens)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      className="h-8 px-2"
                    >
                      Próxima <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function QRCodeSection() {
  const fetchQRList = useServerFn(listQRCodes);
  const createQR = useServerFn(createQRCode);
  const updateQR = useServerFn(updateQRCode);
  const deleteQR = useServerFn(deleteQRCode);

  const [qrList, setQrList] = useState<any[] | null>(null);
  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_qr_collapsed",
    true
  );

  // Dialog and Form states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<any | null>(null);
  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [qrFormat, setQrFormat] = useState<"PNG" | "SVG">("PNG");

  const qrMut = useMutation({
    mutationFn: () => fetchQRList(),
    onSuccess: (r: any) => {
      if (r.ok) setQrList(r.data);
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: (variables: { prefilled_message: string; generate_qr_image: "PNG" | "SVG" }) =>
      createQR({ data: variables }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("QR Code criado com sucesso!");
        setDialogOpen(false);
        setPrefilledMessage("");
        qrMut.mutate();
      } else {
        toast.error(r.error || "Erro ao criar QR Code");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (variables: { code: string; prefilled_message: string; generate_qr_image: "PNG" | "SVG" }) =>
      updateQR({ data: variables }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("QR Code atualizado com sucesso!");
        setDialogOpen(false);
        setEditingQr(null);
        setPrefilledMessage("");
        qrMut.mutate();
      } else {
        toast.error(r.error || "Erro ao atualizar QR Code");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => deleteQR({ data: { code } }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("QR Code excluído com sucesso!");
        qrMut.mutate();
      } else {
        toast.error(r.error || "Erro ao excluir QR Code");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Load items when expanding
  useEffect(() => {
    if (!collapsed && qrList === null && !qrMut.isPending) {
      qrMut.mutate();
    }
  }, [collapsed]);

  const openCreateDialog = () => {
    setEditingQr(null);
    setPrefilledMessage("");
    setQrFormat("PNG");
    setDialogOpen(true);
  };

  const openEditDialog = (qr: any) => {
    setEditingQr(qr);
    setPrefilledMessage(qr.prefilled_message || "");
    setQrFormat("PNG"); // default to PNG as fallback
    setDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingQr) {
      updateMut.mutate({
        code: editingQr.code,
        prefilled_message: prefilledMessage,
        generate_qr_image: qrFormat,
      });
    } else {
      createMut.mutate({
        prefilled_message: prefilledMessage,
        generate_qr_image: qrFormat,
      });
    }
  };

  const handleDelete = (code: string) => {
    if (confirm("Tem certeza que deseja excluir este QR Code?")) {
      deleteMut.mutate(code);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" /> QR Codes do WhatsApp
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie e crie novos QR Codes para os clientes iniciarem conversas rapidamente.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!collapsed && (
            <>
              <Button onClick={openCreateDialog} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Novo QR Code
              </Button>
              <Button 
                onClick={() => qrMut.mutate()} 
                disabled={qrMut.isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${qrMut.isPending ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="shrink-0 gap-1"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-6">
          {!qrList && !qrMut.isPending && (
            <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum QR Code carregado ainda.</p>
              <Button onClick={() => qrMut.mutate()} className="mt-4" variant="secondary">
                Carregar QR Codes
              </Button>
            </div>
          )}

          {qrMut.isPending && !qrList && (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Buscando QR Codes...</p>
            </div>
          )}

          {qrList && qrList.length === 0 && (
            <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
              <p className="text-muted-foreground text-sm">Nenhum QR Code encontrado nesta conta do WhatsApp.</p>
              <Button onClick={openCreateDialog} className="mt-4 gap-1" variant="outline">
                <Plus className="h-4 w-4" /> Criar o Primeiro
              </Button>
            </div>
          )}

          {qrList && qrList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {qrList.map((qr: any) => (
                <Card key={qr.code} className="overflow-hidden flex flex-col group hover:border-primary/50 transition-all duration-300">
                  <div className="p-4 bg-muted/20 flex justify-center relative min-h-[160px] items-center">
                    {qr.qr_image_url ? (
                      <div className="rounded-xl overflow-hidden shadow-sm bg-white p-2 border hover:scale-105 transition-transform duration-300">
                        <img src={qr.qr_image_url} alt="QR Code" className="w-32 h-32 object-contain" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-xl border">
                        <QrCode className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full shadow"
                        onClick={() => openEditDialog(qr)}
                        title="Editar mensagem"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8 rounded-full shadow"
                        onClick={() => handleDelete(qr.code)}
                        title="Excluir QR Code"
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        Código: <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{qr.code}</span>
                      </p>
                    </div>
                    
                    {qr.prefilled_message && (
                      <div className="bg-muted/50 p-2.5 rounded text-xs text-muted-foreground line-clamp-3 italic">
                        "{qr.prefilled_message}"
                      </div>
                    )}
                    
                    <div className="mt-auto pt-2 flex items-center justify-between border-t gap-2">
                      <a 
                        href={qr.deep_link_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-primary hover:underline font-mono truncate max-w-[150px]"
                        title={qr.deep_link_url}
                      >
                        wa.me/...
                      </a>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                        navigator.clipboard.writeText(qr.deep_link_url);
                        toast.success("Link copiado!");
                      }}>
                        <Copy className="h-3 w-3 mr-1" /> Copiar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog for Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingQr ? "Editar QR Code" : "Criar Novo QR Code"}</DialogTitle>
            <DialogDescription>
              {editingQr 
                ? "Atualize a mensagem pré-preenchida que os clientes enviarão."
                : "Defina uma mensagem que os clientes enviarão automaticamente ao escanear o código."
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem pré-preenchida</Label>
              <Textarea
                id="message"
                value={prefilledMessage}
                onChange={(e) => setPrefilledMessage(e.target.value)}
                placeholder="Ex: Olá! Gostaria de saber mais sobre a plataforma."
                className="min-h-[80px]"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="format">Formato da Imagem</Label>
              <Select value={qrFormat} onValueChange={(val: any) => setQrFormat(val)}>
                <SelectTrigger id="format">
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PNG">PNG (Recomendado para visualização rápida)</SelectItem>
                  <SelectItem value="SVG">SVG (Vetorizado - Alta qualidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WABASection() {
  const fetchOwned = useServerFn(listOwnedWABAs);
  const fetchClient = useServerFn(listClientWABAs);
  const fetchInfo = useServerFn(getWABAInfo);
  const saveProfile = useServerFn(updateProfile);
  const subscribeApp = useServerFn(subscribeAppToWABA);
  const getPhoneNumbers = useServerFn(listWABAPhoneNumbers);
  const registerPhone = useServerFn(registerPhoneNumber);
  const qc = useQueryClient();

  const profileQuery = useQuery({ queryKey: ["profile"] });
  const profileData = profileQuery.data as any;

  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_waba_collapsed",
    true
  );

  const [searchId, setSearchId] = useState("");
  const [details, setDetails] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [listType, setListType] = useState<"owned" | "client" | null>(null);

  // Estados para Telefones e Webhooks
  const [phonesMap, setPhonesMap] = useState<Record<string, any[]>>({});
  const [loadingPhones, setLoadingPhones] = useState<Record<string, boolean>>({});
  const [subscribing, setSubscribing] = useState<Record<string, boolean>>({});

  // Estados para Modal de Registro PIN 2FA
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinPhoneId, setPinPhoneId] = useState("");
  const [pinCode, setPinCode] = useState("");

  const searchMut = useMutation({
    mutationFn: (id: string) => fetchInfo({ data: { wabaId: id } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setDetails(res.data || res);
        toast.success("Detalhes da WABA carregados!");
      } else {
        toast.error(res.error || "Não foi possível carregar os detalhes.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const listMut = useMutation({
    mutationFn: async (type: "owned" | "client") => {
      const busId = profileData?.whatsapp_business_id;
      if (!busId) throw new Error("ID da conta de negócios (Business ID) não configurado nas Configurações.");
      
      const fn = type === "owned" ? fetchOwned : fetchClient;
      const res = await fn({ data: { businessId: busId } });
      if (!res.ok) throw new Error(res.error || "Erro ao consultar API da Meta.");
      return { data: res.data || [], type };
    },
    onSuccess: (res) => {
      setList(res.data);
      setListType(res.type);
      toast.success(`Carregadas ${res.data.length} contas WABA (${res.type === "owned" ? "próprias" : "de clientes"})`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const defineActiveMut = useMutation({
    mutationFn: (wabaId: string) => saveProfile({ data: { whatsapp_waba_id: wabaId } }),
    onSuccess: (_, wabaId) => {
      toast.success(`WABA ${wabaId} salva como ativa com sucesso!`);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar WABA ativa: " + e.message),
  });

  const loadPhonesMut = useMutation({
    mutationFn: async (wabaId: string) => {
      setLoadingPhones(p => ({ ...p, [wabaId]: true }));
      const res = await getPhoneNumbers({ data: { wabaId } });
      if (!res.ok) throw new Error(res.error || "Erro ao obter números.");
      return { wabaId, data: res.data || [] };
    },
    onSuccess: (res) => {
      setPhonesMap(p => ({ ...p, [res.wabaId]: res.data }));
      toast.success(`Carregados ${res.data.length} números de telefone!`);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: (_, __, wabaId) => {
      setLoadingPhones(p => ({ ...p, [wabaId]: false }));
    }
  });

  const subscribeAppMut = useMutation({
    mutationFn: async (wabaId: string) => {
      setSubscribing(s => ({ ...s, [wabaId]: true }));
      const res = await subscribeApp({ data: { wabaId } });
      if (!res.ok) throw new Error(res.error || "Erro ao inscrever app.");
      return res;
    },
    onSuccess: () => {
      toast.success("Webhook / App inscrito com sucesso nesta WABA!");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: (_, __, wabaId) => {
      setSubscribing(s => ({ ...s, [wabaId]: false }));
    }
  });

  const defineActivePhoneMut = useMutation({
    mutationFn: (payload: { phoneId: string; displayPhone: string }) =>
      saveProfile({
        data: {
          whatsapp_phone_number_id: payload.phoneId,
          whatsapp_business_phone: payload.displayPhone,
        },
      }),
    onSuccess: (_, payload) => {
      toast.success(`Telefone ${payload.displayPhone} ativado nas Configurações!`);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar telefone ativo: " + e.message),
  });

  const registerPhoneMut = useMutation({
    mutationFn: (payload: { phoneId: string; pin: string }) =>
      registerPhone({ data: { phoneId: payload.phoneId, pin: payload.pin } }),
    onSuccess: () => {
      toast.success("Número de telefone registrado com sucesso na Meta Cloud API!");
      setPinModalOpen(false);
      setPinCode("");
    },
    onError: (e: any) => toast.error("Erro ao registrar número: " + e.message),
  });

  const handleOpenPinModal = (phoneId: string) => {
    setPinPhoneId(phoneId);
    setPinCode("");
    setPinModalOpen(true);
  };

  const handleRegisterPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length !== 6 || /\D/.test(pinCode)) {
      toast.error("O PIN deve conter exatamente 6 dígitos.");
      return;
    }
    registerPhoneMut.mutate({ phoneId: pinPhoneId, pin: pinCode });
  };

  const renderPhoneList = (wabaId: string) => {
    const listPhones = phonesMap[wabaId] ?? [];
    const loading = loadingPhones[wabaId];

    if (loading) {
      return (
        <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 bg-muted/10 rounded border border-dashed mt-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Carregando números da WABA...</span>
        </div>
      );
    }

    if (!phonesMap[wabaId]) return null;

    if (listPhones.length === 0) {
      return (
        <p className="p-3 text-xs text-muted-foreground text-center bg-muted/10 rounded border border-dashed mt-2">
          Nenhum número de telefone encontrado nesta conta.
        </p>
      );
    }

    return (
      <div className="mt-2 border rounded-md divide-y bg-card text-xs overflow-hidden">
        {listPhones.map((ph: any) => (
          <div key={ph.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/10">
            <div>
              <p className="font-semibold text-foreground">{ph.verified_name || "Sem Nome de Exibição"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">+{ph.display_phone_number} (ID: {ph.id})</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Qualidade: <span className={cn(
                  "font-medium",
                  ph.quality_rating === "GREEN" && "text-success",
                  ph.quality_rating === "YELLOW" && "text-amber-500",
                  ph.quality_rating === "RED" && "text-destructive"
                )}>{ph.quality_rating}</span>
                {ph.code_verification_status && ` · Status: ${ph.code_verification_status}`}
              </p>
            </div>
            <div className="flex gap-1.5 self-end sm:self-center shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => defineActivePhoneMut.mutate({ phoneId: ph.id, displayPhone: ph.display_phone_number.replace(/\D/g, "") })}
                disabled={defineActivePhoneMut.isPending}
              >
                Usar Número
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => handleOpenPinModal(ph.id)}
                disabled={registerPhoneMut.isPending}
              >
                Registrar (2FA)
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Contas WhatsApp Business (WABAs)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Inscreva webhooks, liste números de telefone, gerencie e registre chaves 2FA das suas contas comerciais WABA da Meta.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="shrink-0 gap-1"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="hidden sm:inline text-xs">{collapsed ? "Expandir" : "Recolher"}</span>
        </Button>
      </div>

      {!collapsed && (
        <div className="mt-6 space-y-6 pt-6 border-t">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Coluna 1: Consultar WABA Individual */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-foreground">Consultar WABA Individual</h3>
                <p className="text-xs text-muted-foreground">Insira qualquer WABA ID para consultar os detalhes diretamente na Meta.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="ID da WABA (ex: 1123...)"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
                <Button
                  onClick={() => searchId.trim() && searchMut.mutate(searchId.trim())}
                  disabled={searchMut.isPending || !searchId.trim()}
                >
                  {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}
                </Button>
              </div>

              {details && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm">{details.name || "Conta sem Nome"}</span>
                    <Badge variant="secondary" className={cn(details.status === "APPROVED" ? "bg-success/15 text-success hover:bg-success/20 border-none" : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20 border-none")}>
                      {details.status}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1 font-mono">
                    <p className="text-muted-foreground"><span className="font-sans font-medium">ID:</span> {details.id}</p>
                    {details.timezone_id && <p className="text-muted-foreground"><span className="font-sans font-medium">Fuso Horário:</span> {details.timezone_id}</p>}
                    {details.currency && <p className="text-muted-foreground"><span className="font-sans font-medium">Moeda:</span> {details.currency}</p>}
                    {details.message_limit && <p className="text-muted-foreground"><span className="font-sans font-medium">Limite:</span> {details.message_limit}</p>}
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        variant="default"
                        onClick={() => defineActiveMut.mutate(details.id)}
                        disabled={defineActiveMut.isPending}
                      >
                        Definir como WABA Ativa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => subscribeAppMut.mutate(details.id)}
                        disabled={subscribing[details.id]}
                      >
                        {subscribing[details.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Inscrever Webhook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadPhonesMut.mutate(details.id)}
                        disabled={loadingPhones[details.id]}
                      >
                        {loadingPhones[details.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Ver Telefones
                      </Button>
                    </div>

                    {renderPhoneList(details.id)}
                  </div>
                </div>
              )}
            </div>

            {/* Coluna 2: Listagem por Business ID */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-foreground">Listar WABAs por Business ID</h3>
                <p className="text-xs text-muted-foreground">Listar todas as contas WABAs associadas ao seu Meta Business ID.</p>
              </div>

              {profileData?.whatsapp_business_id ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={listType === "owned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => listMut.mutate("owned")}
                      disabled={listMut.isPending}
                    >
                      {listMut.isPending && listType === "owned" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Próprias (Owned)
                    </Button>
                    <Button
                      variant={listType === "client" ? "default" : "outline"}
                      size="sm"
                      onClick={() => listMut.mutate("client")}
                      disabled={listMut.isPending}
                    >
                      {listMut.isPending && listType === "client" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Clientes (Client)
                    </Button>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto border rounded-lg divide-y bg-background">
                    {list.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center">
                        Nenhuma conta carregada. Clique em um dos botões acima para buscar.
                      </p>
                    ) : (
                      list.map((w: any) => (
                        <div key={w.id} className="p-3 flex flex-col gap-3 text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{w.name}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">ID: {w.id}</p>
                              <p className="text-muted-foreground text-[10px] mt-0.5">
                                Fuso: {w.timezone_id} · Limite: {w.message_limit ?? "N/A"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="secondary" className={cn(w.status === "APPROVED" ? "bg-success/15 text-success hover:bg-success/20 border-none" : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20 border-none")}>
                                {w.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => defineActiveMut.mutate(w.id)}
                                disabled={defineActiveMut.isPending}
                              >
                                Ativar
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-dashed">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              onClick={() => subscribeAppMut.mutate(w.id)}
                              disabled={subscribing[w.id]}
                            >
                              {subscribing[w.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Inscrever Webhook
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2 ml-auto"
                              onClick={() => loadPhonesMut.mutate(w.id)}
                              disabled={loadingPhones[w.id]}
                            >
                              {loadingPhones[w.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              {phonesMap[w.id] ? "Ocultar Números" : "Ver Números"}
                            </Button>
                          </div>

                          {renderPhoneList(w.id)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-2">
                  <p className="font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Business ID não configurado
                  </p>
                  <p className="leading-relaxed">
                    Você precisa salvar o <strong>ID da conta de negócios (Meta Business ID)</strong> no passo 1 do assistente acima para poder listar suas contas WABA.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Registro PIN 2FA */}
      <Dialog open={pinModalOpen} onOpenChange={setPinModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Número na API Cloud (2FA)</DialogTitle>
            <DialogDescription>
              Insira o PIN de 2 fatores (2FA) de 6 dígitos que você definiu para este número de telefone no painel do WhatsApp Manager.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterPhone} className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="pin-code">PIN de 6 dígitos</Label>
              <Input
                id="pin-code"
                placeholder="Ex: 123456"
                type="password"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-lg tracking-widest"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                📍 Onde achar/definir: WhatsApp Manager → Ferramentas → Configurações do número de telefone → Confirmação em duas etapas.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPinModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={registerPhoneMut.isPending || pinCode.length !== 6}>
                {registerPhoneMut.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
