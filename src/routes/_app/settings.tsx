import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile, rotateApiKey, pingMeta, sendTestMessage, getTestMessageStatus, sendHelloWorldTemplate } from "@/lib/profile.functions";
import { getCurrentUserRoles, getPlatformSettings, updatePlatformSettings, exportSchemaSql, listSchemaBackups, getSchemaBackup, createSchemaBackupNow, deleteSchemaBackup } from "@/lib/admin.functions";
import { getWebhookHealth } from "@/lib/webhook-health.functions";
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
import { Copy, RefreshCw, AlertTriangle, Check, CheckCheck, Clock, XCircle, FileText, Shield, Trash2, ShieldCheck, Lock, Monitor, Sun, Moon, Database, Download, KeyRound, Webhook, Send, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
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
      <PageHeader title="Configurações" subtitle="Conecte sua conta do WhatsApp Business em poucos passos. Não se preocupe se nunca fez isso antes — explicamos cada campo." />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AppearanceCard />
        <ChangePasswordCard />
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
              hint="Aparece logo abaixo do número, no quadro 'De'. Só números, sem espaços."
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
              hint="No painel da Meta, fica em 'Visão geral da conta'. Bem comprido, só números."
              success={validateMetaId(String(form.whatsapp_waba_id ?? ""), "WABA ID").ok ? `Formato OK · ${String(form.whatsapp_waba_id).length} dígitos` : null}
              error={errors.whatsapp_waba_id}
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
              <Label className="flex items-baseline gap-2">
                <span>Token de acesso permanente</span>
                <span className="text-[11px] font-normal text-muted-foreground">(Access Token de System User)</span>
              </Label>
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
                whatsapp_business_phone: form.whatsapp_business_phone,
                whatsapp_access_token: form.whatsapp_access_token,
                rate_limit_per_second: form.rate_limit_per_second,
              });
            }} disabled={saveMut.isPending}>Salvar e conectar</Button>
            <Button variant="outline" onClick={() => pingMut.mutate()} disabled={pingMut.isPending}>
              Testar conexão agora
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            💡 Clique em <strong>"Testar conexão"</strong> depois de salvar — se aparecer ✅, está tudo certo.
          </p>
          {pingResult && (
            <ResultAlert
              ok={!!pingResult.ok}
              successContent={
                <span>Tudo certo! Conectado a <strong>{pingResult.info?.verified_name}</strong> ({pingResult.info?.display_phone_number}) · qualidade do número: {pingResult.info?.quality_rating}</span>
              }
              error={pingResult.error}
              details={pingResult.details ?? pingResult.error}
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
          <h2 className="font-display text-lg font-semibold">Conectar com outros sistemas (CRM, automações)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use a chave abaixo para receber contatos automaticamente do seu CRM (HubSpot, RD Station, n8n, Zapier, etc).
            Se nunca usou isso, pode ignorar esta seção — não é obrigatório para enviar mensagens.
          </p>
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
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-4" />

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
      </div>

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
    </Card>
  );
}

function AppearanceCard() {
  const { theme, isSystem, resetTheme, setTheme } = useTheme();

  const handleReset = () => {
    resetTheme();
    toast.success("Tema sincronizado com a preferência do sistema");
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Aparência</h2>
      <p className="mt-1 text-sm text-muted-foreground">Personalize o tema do painel. A mudança é aplicada imediatamente.</p>
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
      {hint && !error && !success && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
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

      <div className="mt-6 border-t pt-5">
        <h3 className="font-display text-base font-semibold">Tags personalizadas (Analytics, Pixel, etc.)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole snippets completos (com <code className="text-xs">&lt;script&gt;</code>, <code className="text-xs">&lt;meta&gt;</code>, <code className="text-xs">&lt;noscript&gt;</code>…). Eles serão injetados em <strong>todas as páginas</strong> da plataforma para todos os usuários.
        </p>
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
      </div>

      <div className="mt-6 border-t pt-5">
        <h3 className="font-display text-base font-semibold">Segredo do Cron (CRON_SECRET)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Token usado para autenticar o agendador (pg_cron) ao chamar{" "}
          <code className="text-xs">/api/public/cron/process-queue</code>. Se vazio, o endpoint fica <strong>aberto</strong> (apenas para testes).
        </p>
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
    </Card>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("A nova senha precisa ter ao menos 8 caracteres.");
    if (next !== confirmPwd) return toast.error("As senhas não coincidem.");
    setBusy(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("Sessão expirada");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signErr) throw new Error("Senha atual incorreta");
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Senha atualizada");
      setCurrent(""); setNext(""); setConfirmPwd("");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao atualizar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Lock className="h-5 w-5" /> Trocar senha
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe sua senha atual e escolha uma nova senha com no mínimo 8 caracteres.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cur-pwd">Senha atual</Label>
          <PasswordInput id="cur-pwd" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pwd">Nova senha</Label>
          <PasswordInput id="new-pwd" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfm-pwd">Confirmar</Label>
          <PasswordInput id="cfm-pwd" minLength={8} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
        </div>
        <div className="md:col-span-3">
          <Button type="submit" disabled={busy}>Atualizar senha</Button>
        </div>
      </form>
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
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

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
    </Card>
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
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
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

  return (
    <div className="mt-4 rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-medium">Histórico de versões</div>
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
      </div>

      {isLoading ? (
        <div className="p-3 text-xs text-muted-foreground">Carregando…</div>
      ) : backups.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">
          Nenhum backup ainda. O primeiro será gerado automaticamente às 03:00 (UTC), ou clique em "Gerar backup agora".
        </div>
      ) : (
        <ul className="divide-y">
          {backups.map((b: any) => (
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
      )}
    </div>
  );
}




