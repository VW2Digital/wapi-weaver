import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile, rotateApiKey, pingMeta } from "@/lib/profile.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

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
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState<any>({});
  const [pingResult, setPingResult] = useState<any>(null);

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

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
          <p className="mt-1 text-sm text-muted-foreground">Encontre no <strong>Meta Business Manager → WhatsApp Manager → Configurações da API</strong>.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Phone Number ID" value={form.whatsapp_phone_number_id} onChange={(v) => setForm({ ...form, whatsapp_phone_number_id: v })} placeholder="123456789012345" />
            <Field label="WhatsApp Business Account ID (WABA)" value={form.whatsapp_waba_id} onChange={(v) => setForm({ ...form, whatsapp_waba_id: v })} placeholder="123456789012345" />
            <Field label="Número do WhatsApp (apenas exibição)" value={form.whatsapp_business_phone} onChange={(v) => setForm({ ...form, whatsapp_business_phone: v })} placeholder="+55 11 99999-0000" />
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
            <Button onClick={() => saveMut.mutate({
              whatsapp_phone_number_id: form.whatsapp_phone_number_id,
              whatsapp_waba_id: form.whatsapp_waba_id,
              whatsapp_business_phone: form.whatsapp_business_phone,
              whatsapp_access_token: form.whatsapp_access_token,
              rate_limit_per_second: form.rate_limit_per_second,
            })} disabled={saveMut.isPending}>Salvar credenciais</Button>
            <Button variant="outline" onClick={() => pingMut.mutate()} disabled={pingMut.isPending}>
              Testar conexão
            </Button>
          </div>
          {pingResult && (
            <div className={`mt-3 flex items-start gap-2 rounded-md border p-3 text-sm ${pingResult.ok ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
              {pingResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />}
              <div>
                {pingResult.ok ? (
                  <span>Conectado a <strong>{pingResult.info?.verified_name}</strong> ({pingResult.info?.display_phone_number}) · qualidade: {pingResult.info?.quality_rating}</span>
                ) : (
                  <span>{pingResult.error}</span>
                )}
              </div>
            </div>
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

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
