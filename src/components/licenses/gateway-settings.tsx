import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Loader2, RefreshCw, Activity, ShieldAlert, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function GatewaySettings({ enabled = true }: { enabled?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [checkoutMode, setCheckoutMode] = useState<"transparent" | "redirect">("redirect");
  const [sandboxPublicKey, setSandboxPublicKey] = useState("");
  const [sandboxClientId, setSandboxClientId] = useState("");
  const [sandboxAccessToken, setSandboxAccessToken] = useState("");
  const [sandboxClientSecret, setSandboxClientSecret] = useState("");
  const [productionPublicKey, setProductionPublicKey] = useState("");
  const [productionClientId, setProductionClientId] = useState("");
  const [productionAccessToken, setProductionAccessToken] = useState("");
  const [productionClientSecret, setProductionClientSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  // Visibility Toggles
  const [showSandboxToken, setShowSandboxToken] = useState(false);
  const [showSandboxSecret, setShowSandboxSecret] = useState(false);
  const [showProdToken, setShowProdToken] = useState(false);
  const [showProdSecret, setShowProdSecret] = useState(false);

  // Test Connection result state
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (enabled) fetchSettings();
  }, [enabled]);

  const getAuthHeaders = (contentTypeJson = false): Record<string, string> => {
    const token = localStorage.getItem("app-token");
    const headers: Record<string, string> = {};
    if (contentTypeJson) {
      headers["Content-Type"] = "application/json";
    }
    if (token && token !== "null" && token !== "undefined") {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-gateways/mercadopago", {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        // Se ainda não foi configurado ou retornou 404/401, simplesmente finaliza sem toast de erro intrusivo
        return;
      }

      const data = await res.json();
      setEnvironment(data.environment || "sandbox");
      setCheckoutMode(data.checkout_mode || "redirect");
      setSandboxPublicKey(data.sandbox_public_key || "");
      setSandboxClientId(data.sandbox_client_id || "");
      setSandboxAccessToken(data.sandbox_access_token || "");
      setSandboxClientSecret(data.sandbox_client_secret || "");
      setProductionPublicKey(data.production_public_key || "");
      setProductionClientId(data.production_client_id || "");
      setProductionAccessToken(data.production_access_token || "");
      setProductionClientSecret(data.production_client_secret || "");
      setWebhookSecret(data.webhook_secret || "");
      setWebhookUrl(data.webhook_url || "");
    } catch (err: any) {
      console.warn("Mercado Pago settings fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/payment-gateways/mercadopago", {
        method: "PUT",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          environment,
          checkout_mode: checkoutMode,
          sandbox_public_key: sandboxPublicKey,
          sandbox_client_id: sandboxClientId,
          sandbox_access_token: sandboxAccessToken,
          sandbox_client_secret: sandboxClientSecret,
          production_public_key: productionPublicKey,
          production_client_id: productionClientId,
          production_access_token: productionAccessToken,
          production_client_secret: productionClientSecret,
          webhook_secret: webhookSecret,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.error || data.message || `Erro ${res.status}: Não foi possível salvar as configurações.`;
        throw new Error(message);
      }

      toast.success("Configurações do Mercado Pago salvas com sucesso!");
      fetchSettings(); // Refresh list to get masked inputs again
    } catch (err: any) {
      toast.error(err.message || "Falha ao salvar gateway.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/payment-gateways/mercadopago/test", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          environment,
          sandbox_access_token: sandboxAccessToken,
          production_access_token: productionAccessToken,
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
      });
      if (data.success) {
        toast.success("Teste concluído: Conexão bem-sucedida!");
      } else {
        toast.error("Teste concluído: Conexão falhou.");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Erro de rede.",
      });
      toast.error("Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL do Webhook copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const [copiedAlt, setCopiedAlt] = useState(false);
  const handleCopyAltWebhook = () => {
    navigator.clipboard.writeText("https://meudominio.com.br/functions/v1/mercadopago-webhook");
    setCopiedAlt(true);
    toast.success("URL do Webhook Alternativo copiada!");
    setTimeout(() => setCopiedAlt(false), 2000);
  };

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Carregando configurações do gateway...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Gateway Mercado Pago
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Prioritário
            </span>
          </CardTitle>
          <CardDescription>
            Configure as credenciais e o comportamento de cobranças automatizadas via Mercado Pago
            para a sua plataforma SaaS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Ambiente Selector */}
              <div className="space-y-2">
                <Label htmlFor="environment">Ambiente Ativo</Label>
                <Select
                  value={environment}
                  onValueChange={(val: any) => {
                    setEnvironment(val);
                    setTestResult(null);
                  }}
                >
                  <SelectTrigger id="environment" className="w-full">
                    <SelectValue placeholder="Selecione o ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox / Testes</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Altere para sandbox para homologar a plataforma sem custos reais.
                </p>
              </div>

              {/* Modo de Checkout */}
              <div className="space-y-2">
                <Label htmlFor="checkoutMode">Modo de Checkout</Label>
                <Select value={checkoutMode} onValueChange={(val: any) => setCheckoutMode(val)}>
                  <SelectTrigger id="checkoutMode" className="w-full">
                    <SelectValue placeholder="Selecione o modo de checkout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="redirect">Redirect — Checkout Pro Mercado Pago</SelectItem>
                    <SelectItem value="transparent">
                      Transparente — PIX e Cartão na Plataforma
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecione se o checkout ocorrerá dentro da plataforma ou via redirecionamento.
                </p>
              </div>
            </div>

            {/* Credenciais de Sandbox — sempre visível */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                Credenciais de Sandbox (Testes)
              </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s_public_key">Public Key</Label>
                    <Input
                      id="s_public_key"
                      value={sandboxPublicKey}
                      onChange={(e) => setSandboxPublicKey(e.target.value)}
                      placeholder="ex: APP_USR-... ou TEST-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_access_token">Access Token</Label>
                    <div className="relative">
                      <Input
                        id="s_access_token"
                        type={showSandboxToken ? "text" : "password"}
                        value={sandboxAccessToken}
                        onChange={(e) => setSandboxAccessToken(e.target.value)}
                        placeholder="ex: TEST-3598901240..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowSandboxToken(!showSandboxToken)}
                      >
                        {showSandboxToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_client_id">Client ID (User ID)</Label>
                    <Input
                      id="s_client_id"
                      value={sandboxClientId}
                      onChange={(e) => setSandboxClientId(e.target.value)}
                      placeholder="ex: 3598901240"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_client_secret">Client Secret (Opcional)</Label>
                    <div className="relative">
                      <Input
                        id="s_client_secret"
                        type={showSandboxSecret ? "text" : "password"}
                        value={sandboxClientSecret}
                        onChange={(e) => setSandboxClientSecret(e.target.value)}
                        placeholder="Opcional"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowSandboxSecret(!showSandboxSecret)}
                      >
                        {showSandboxSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
            </div>

            {/* Credenciais de Produção — sempre visível */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-500">
                Credenciais de Produção (Real)
              </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p_public_key">Public Key</Label>
                    <Input
                      id="p_public_key"
                      value={productionPublicKey}
                      onChange={(e) => setProductionPublicKey(e.target.value)}
                      placeholder="ex: APP_USR-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_access_token">Access Token</Label>
                    <div className="relative">
                      <Input
                        id="p_access_token"
                        type={showProdToken ? "text" : "password"}
                        value={productionAccessToken}
                        onChange={(e) => setProductionAccessToken(e.target.value)}
                        placeholder="ex: APP_USR-..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowProdToken(!showProdToken)}
                      >
                        {showProdToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_client_id">Client ID (User ID)</Label>
                    <Input
                      id="p_client_id"
                      value={productionClientId}
                      onChange={(e) => setProductionClientId(e.target.value)}
                      placeholder="ex: 123456789012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_client_secret">Client Secret (Opcional)</Label>
                    <div className="relative">
                      <Input
                        id="p_client_secret"
                        type={showProdSecret ? "text" : "password"}
                        value={productionClientSecret}
                        onChange={(e) => setProductionClientSecret(e.target.value)}
                        placeholder="Opcional"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowProdSecret(!showProdSecret)}
                      >
                        {showProdSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
            </div>

            {/* Webhook URL Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold">Configuração do Webhook</h3>
              <div className="space-y-2">
                <Label htmlFor="webhook_url">URL de Notificação Oficial</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook_url"
                    value={webhookUrl}
                    readOnly
                    className="bg-muted text-muted-foreground flex-1 font-mono text-xs select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyWebhook}
                    className="gap-2 shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastre essa URL exatamente como exibida acima no painel do Mercado Pago em{" "}
                  <strong>Integrações &gt; Webhooks</strong> e marque os eventos de{" "}
                  <strong>payment</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_alt_url">URL de Notificação Alternativa (Opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook_alt_url"
                    value="https://meudominio.com.br/functions/v1/mercadopago-webhook"
                    readOnly
                    className="bg-muted text-muted-foreground flex-1 font-mono text-xs select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyAltWebhook}
                    className="gap-2 shrink-0"
                  >
                    {copiedAlt ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use este link secundário caso prefira encaminhar notificações por meio de uma Edge
                  Function externa de contingência.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Chave de Assinatura Webhook (Opcional)</Label>
                <Input
                  id="webhook_secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Se gerado pelo painel do Mercado Pago"
                />
              </div>
            </div>

            {/* Test connection display */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 text-sm ${
                  testResult.success
                    ? "bg-green-500/10 border-green-500/25 text-green-700 dark:text-green-400"
                    : "bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400"
                }`}
              >
                {testResult.success ? (
                  <Check className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-semibold block">
                    {testResult.success ? "Conexão Bem Sucedida" : "Erro de Conexão"}
                  </span>
                  <span className="text-xs">{testResult.message}</span>
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-between items-center border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || saving}
                className="gap-2 font-medium"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4 text-primary" />
                )}
                Testar Integração
              </Button>

              <Button
                type="submit"
                disabled={saving || testing}
                className="gap-2 font-medium !rounded-md px-6"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Configuração
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
