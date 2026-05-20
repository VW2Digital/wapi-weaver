import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile, rotateApiKey, pingMeta, sendTestMessage, getTestMessageStatus } from "@/lib/profile.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, AlertTriangle, Check, CheckCheck, Clock, XCircle } from "lucide-react";
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
            Envia uma mensagem de texto simples direto pela WhatsApp Cloud API. O destinatário precisa ter conversado com seu número nas últimas 24h (janela de atendimento) — fora disso, use um template aprovado.
          </p>
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
          <div className="mt-4">
            <Button
              onClick={() => {
                if (testTo.length < 8) { toast.error("Informe um número válido (apenas dígitos)."); return; }
                if (!testText.trim()) { toast.error("Escreva a mensagem."); return; }
                setTestResult(null);
                testMut.mutate({ to: testTo, text: testText.trim() });
              }}
              disabled={testMut.isPending}
            >
              {testMut.isPending ? "Enviando…" : "Enviar teste"}
            </Button>
          </div>
          {testResult && (
            <ResultAlert
              ok={!!testResult.ok}
              successContent={
                <span>Enviado para <strong>{testResult.sent_to}</strong>{testResult.wa_message_id ? <> · id <code className="text-xs">{testResult.wa_message_id}</code></> : null}</span>
              }
              error={testResult.error}
              details={testResult.details}
              fallback="Falha ao enviar a mensagem de teste."
            />
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
      </div>
    </div>
  );
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
