import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { toast } from "sonner";

function getAuthHeaders(contentTypeJson = false): Record<string, string> {
  const token = localStorage.getItem("app-token");
  const headers: Record<string, string> = {};
  if (contentTypeJson) headers["Content-Type"] = "application/json";
  if (token && token !== "null" && token !== "undefined") {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function EmailProviderSettings({ enabled = true }: { enabled?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [testTo, setTestTo] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-provider", { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar configuração");
      setFromEmail(data.from_email ?? "");
      setFromName(data.from_name ?? "");
      setReplyTo(data.reply_to ?? "");
      setApiKey(data.api_key ?? "");
      setIsActive(data.is_active !== false);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao carregar Resend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) void fetchSettings();
  }, [enabled]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-provider", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          from_email: fromEmail,
          from_name: fromName,
          reply_to: replyTo,
          api_key: apiKey,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      toast.success("Configuração de e-mail salva.");
      setApiKey(data.api_key ?? apiKey);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/email-provider/test", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          from_email: fromEmail,
          from_name: fromName,
          reply_to: replyTo,
          api_key: apiKey,
          to: testTo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Falha no teste");
      toast.success(data.message || "E-mail de teste enviado.");
    } catch (err: any) {
      toast.error(err.message ?? "Falha no teste");
    } finally {
      setTesting(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-mail transacional (Resend)
          </CardTitle>
          <CardDescription>
            Conecte a API da Resend para enviar o link de recuperação de senha. A chave é
            armazenada criptografada e não aparece em logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="resend-from-name">Nome do remetente</Label>
                <Input
                  id="resend-from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Bliv"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resend-from-email">E-mail remetente</Label>
                <Input
                  id="resend-from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@seudominio.com"
                />
                <p className="text-xs text-muted-foreground">
                  Precisa ser um domínio verificado na Resend.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resend-reply">Reply-to (opcional)</Label>
                <Input
                  id="resend-reply"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="suporte@seudominio.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resend-key">API key</Label>
                <PasswordInput
                  id="resend-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="re_..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Envio ativo
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
              <div className="border-t pt-4 space-y-3">
                <Label htmlFor="resend-test-to">E-mail de teste</Label>
                <Input
                  id="resend-test-to"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="Seu e-mail para receber o teste"
                />
                <Button type="button" variant="outline" onClick={() => void test()} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar e-mail de teste
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
