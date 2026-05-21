import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile, rotateApiKey, pingMeta, sendTestMessage, getTestMessageStatus, sendHelloWorldTemplate } from "@/lib/profile.functions";
import { getCurrentUserRoles, getPlatformSettings, updatePlatformSettings } from "@/lib/admin.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, AlertTriangle, Check, CheckCheck, Clock, XCircle, FileText, Shield, Trash2, ShieldCheck, Lock } from "lucide-react";
import { ResultAlert } from "@/components/result-alert";


export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function validateDigitsField(v: string, label: string): string | null {
  if (!v) return `${label} é obrigatório.`;
  if (/\D/.test(v)) return `${label} deve conter apenas dígitos (0-9).`;
  return null;
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

  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pingResult, setPingResult] = useState<any>(null);
  const [testTo, setTestTo] = useState("");
  const [testText, setTestText] = useState("Mensagem de teste ✅");
  const [testResult, setTestResult] = useState<any>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<{ status: string; timestamp?: string; error?: any } | null>(null);
  const pollRef = useRef<number | null>(null);

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
      <PageHeader title="Configurações" subtitle="Cole aqui suas credenciais do WhatsApp Cloud API." />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AdminPlatformSection />

        <Card className="p-6">

          <h2 className="font-display text-lg font-semibold">Credenciais Meta</h2>
          <p className="mt-1 text-sm text-muted-foreground">Encontre no <strong>Meta Business Manager → WhatsApp Manager → Configurações da API</strong>. Os campos numéricos aceitam apenas dígitos (0-9).</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Phone Number ID" digitsOnly value={form.whatsapp_phone_number_id} onChange={(v) => { setErrors((e) => ({ ...e, whatsapp_phone_number_id: null })); setForm({ ...form, whatsapp_phone_number_id: v }); }} placeholder="Ex: 1065xxxxxxxxx" error={errors.whatsapp_phone_number_id} />
            <Field label="WhatsApp Business Account ID (WABA)" digitsOnly value={form.whatsapp_waba_id} onChange={(v) => { setErrors((e) => ({ ...e, whatsapp_waba_id: null })); setForm({ ...form, whatsapp_waba_id: v }); }} placeholder="Ex: 1123xxxxxxxxx" error={errors.whatsapp_waba_id} />
            <Field label="Número do WhatsApp (apenas exibição)" value={form.whatsapp_business_phone} onChange={(v) => setForm({ ...form, whatsapp_business_phone: v })} placeholder="5511999990000" />
            <Field label="Rate limit (msg/seg)" type="number" value={form.rate_limit_per_second?.toString() ?? "20"} onChange={(v) => setForm({ ...form, rate_limit_per_second: Number(v) })} />

            <div className="md:col-span-2 space-y-1.5">
              <Label>Access Token permanente (System User)</Label>
              <Textarea
                rows={3}
                value={form.whatsapp_access_token ?? ""}
                onChange={(e) => setForm({ ...form, whatsapp_access_token: e.target.value })}
                placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxx..."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => {
              const nextErrors: Record<string, string | null> = {};
              const err1 = validateDigitsField(String(form.whatsapp_phone_number_id ?? ""), "Phone Number ID");
              if (err1) nextErrors.whatsapp_phone_number_id = err1;
              const err2 = validateDigitsField(String(form.whatsapp_waba_id ?? ""), "WABA ID");
              if (err2) nextErrors.whatsapp_waba_id = err2;
              setErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                toast.error("Corrija os erros antes de salvar.");
                return;
              }
              saveMut.mutate({
                whatsapp_phone_number_id: form.whatsapp_phone_number_id,
                whatsapp_waba_id: form.whatsapp_waba_id,
                whatsapp_business_phone: form.whatsapp_business_phone,
                whatsapp_access_token: form.whatsapp_access_token,
                rate_limit_per_second: form.rate_limit_per_second,
              });
            }} disabled={saveMut.isPending}>Salvar credenciais</Button>
            <Button variant="outline" onClick={() => pingMut.mutate()} disabled={pingMut.isPending}>
              Testar conexão
            </Button>
          </div>
          {pingResult && (
            <ResultAlert
              ok={!!pingResult.ok}
              successContent={
                <span>Conectado a <strong>{pingResult.info?.verified_name}</strong> ({pingResult.info?.display_phone_number}) · qualidade: {pingResult.info?.quality_rating}</span>
              }
              error={pingResult.error}
              details={pingResult.details ?? pingResult.error}
              fallback="Não foi possível conectar à WhatsApp Cloud API."
            />
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Enviar mensagem de teste</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envia uma mensagem de texto simples direto pela WhatsApp Cloud API.
          </p>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
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





        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Webhook da Meta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No painel da Meta (<em>App Dashboard → WhatsApp → Configuration</em>), use os valores abaixo. Selecione o campo <code>messages</code> ao se inscrever.
          </p>
          <div className="mt-4 space-y-3">
            <ReadOnly label="Callback URL" value={webhookUrl} onCopy={() => copy(webhookUrl, "URL do webhook")} />
            <div className="space-y-1.5">
              <Label>Verify Token (defina o que quiser, depois cole o mesmo na Meta)</Label>
              <div className="flex gap-2">
                <Input value={form.whatsapp_verify_token ?? ""} onChange={(e) => setForm({ ...form, whatsapp_verify_token: e.target.value })} placeholder="ex: meu_token_super_secreto_123" />
                <Button onClick={() => saveMut.mutate({ whatsapp_verify_token: form.whatsapp_verify_token })}>Salvar</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>App Secret (para validar a assinatura dos webhooks)</Label>
              <div className="flex gap-2">
                <Input type="password" value={form.whatsapp_app_secret ?? ""} onChange={(e) => setForm({ ...form, whatsapp_app_secret: e.target.value })} placeholder="App secret do seu app na Meta" />
                <Button onClick={() => saveMut.mutate({ whatsapp_app_secret: form.whatsapp_app_secret })}>Salvar</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">API para integração externa (CRM)</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use esta chave para enviar contatos de outros sistemas (HubSpot, RD, n8n, Zapier…).</p>
          <div className="mt-4 space-y-3">
            <ReadOnly label="Endpoint POST" value={ingestUrl} onCopy={() => copy(ingestUrl, "Endpoint")} />
            <div className="space-y-1.5">
              <Label>Sua API key</Label>
              <div className="flex gap-2">
                <Input readOnly value={form.api_key ?? ""} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => copy(form.api_key ?? "", "API key")}><Copy className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={() => rotateMut.mutate()} disabled={rotateMut.isPending}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <pre className="overflow-auto rounded-md bg-sidebar p-3 text-xs text-sidebar-foreground">
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
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Documentos legais</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leia nossos termos e saiba como seus dados são tratados.</p>
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
        </Card>
      </div>
    </div>
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

function Field({ label, value, onChange, type = "text", placeholder, digitsOnly, error }: { label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string; digitsOnly?: boolean; error?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(digitsOnly ? onlyDigits(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={error ? "border-destructive focus-visible:ring-destructive" : ""}
        inputMode={digitsOnly ? "numeric" : undefined}
        pattern={digitsOnly ? "[0-9]*" : undefined}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
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

  useEffect(() => {
    if (settings) {
      setAppId(settings.meta_app_id ?? "");
      setConfigId(settings.meta_config_id ?? "");
      setGraphVersion(settings.meta_graph_version ?? "v20.0");
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
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Meta App ID</Label>
          <Input
            value={appId}
            onChange={(e) => setAppId(onlyDigits(e.target.value))}
            placeholder="Ex: 1234567890123456"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <p className="text-[11px] text-muted-foreground">Painel do App → cabeçalho superior</p>
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
          <p className="text-[11px] text-muted-foreground">WhatsApp → Configuração → Registro incorporado</p>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label>App Secret</Label>
          <Input
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder={settings?.meta_app_secret_set ? "•••••••••••••••• (já configurado — deixe vazio para manter)" : "Cole aqui o App Secret"}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Configurações → Básico → Chave Secreta do App.{" "}
            {settings?.meta_app_secret_set && <span className="text-success font-medium">✓ Atualmente configurado</span>}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Graph API Version</Label>
          <Input value={graphVersion} onChange={(e) => setGraphVersion(e.target.value)} placeholder="v20.0" />
        </div>

        <div className="space-y-1.5 flex flex-col justify-end">
          <p className="text-[11px] text-muted-foreground">
            {settings?.updated_at && <>Última atualização: {new Date(settings.updated_at).toLocaleString()}</>}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() =>
            mut.mutate({
              meta_app_id: appId || undefined,
              meta_app_secret: appSecret || undefined,
              meta_config_id: configId || undefined,
              meta_graph_version: graphVersion || undefined,
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
    </Card>
  );
}
