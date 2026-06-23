import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getProfile,
  updateProfile,
  rotateApiKey,
  pingMeta,
  sendTestMessage,
  getTestMessageStatus,
  sendHelloWorldTemplate,
  getQRCode,
  listQRCodes,
  createQRCode,
  updateQRCode,
  deleteQRCode,
  listOwnedWABAs,
  listClientWABAs,
  getWABAInfo,
  updateWABA,
  subscribeAppToWABA,
  listWABAPhoneNumbers,
  registerPhoneNumber,
  debugAccessToken,
  listAssignedWABAs,
  getWABABotDetails,
  checkCallPermissions,
  manageCall,
  sendAdvancedSandboxMessage,
  uploadMetaMedia,
  requestVerificationCode,
  verifyVerificationCode,
  deregisterPhoneNumber,
  getPhoneSettings,
  updatePhoneSettings,
  getOBAStatus,
  applyForOBA,
  getSinglePhoneInfo,
  updatePhoneConfig,
  getSolutionDetails,
  acceptSolutionInvitation,
  rejectSolutionInvitation,
  sendSolutionDeactivation,
  acceptSolutionDeactivation,
  rejectSolutionDeactivation,
  getSolutionAccessToken,
} from "@/lib/profile.functions";
import {
  getCurrentUserRoles,
  getPlatformSettings,
  updatePlatformSettings,
  exportSchemaSql,
  listSchemaBackups,
  getSchemaBackup,
  createSchemaBackupNow,
  deleteSchemaBackup,
  getSidebarOrder,
  updateSidebarOrder,
} from "@/lib/admin.functions";
import { getWebhookHealth, listWebhookEvents } from "@/lib/webhook-health.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  RefreshCw,
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  FileText,
  Shield,
  Trash2,
  ShieldCheck,
  Lock,
  Monitor,
  Sun,
  Moon,
  Database,
  Download,
  KeyRound,
  Webhook,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  QrCode,
  Plus,
  Pencil,
  Loader2,
  Settings,
  Phone,
  UploadCloud,
  Users,
  Smartphone,
  Bot,
  LayoutDashboard,
  MessageCircle,
  ListChecks,
  UserCog,
  Kanban,
  Receipt,
  ScrollText,
  Activity,
} from "lucide-react";
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
  if (/\D/.test(v))
    return { error: `Apenas números são aceitos. Remova letras, espaços ou símbolos.`, ok: false };
  if (v.length < 10)
    return {
      error: `Muito curto (${v.length} dígitos). O ${label} geralmente tem entre 15 e 17 dígitos.`,
      ok: false,
    };
  if (v.length > 20)
    return {
      error: `Muito longo (${v.length} dígitos). Confira se copiou apenas o ID.`,
      ok: false,
    };
  if (v.length < 14)
    return {
      error: `Está com ${v.length} dígitos — geralmente são 15 ou mais. Confira se copiou o número inteiro.`,
      ok: false,
    };
  return { error: null, ok: true };
}

/** Validação em tempo real para o Access Token da Meta. */
function validateAccessToken(v: string): {
  error: string | null;
  warning: string | null;
  ok: boolean;
} {
  const t = (v ?? "").trim();
  if (!t) return { error: null, warning: null, ok: false };
  if (/\s/.test(t))
    return {
      error: `O token não pode conter espaços ou quebras de linha. Copie de novo, todo de uma vez.`,
      warning: null,
      ok: false,
    };
  if (!/^[A-Za-z0-9_-]+$/.test(t))
    return {
      error: `O token tem caracteres inválidos. Use apenas letras, números, "_" e "-".`,
      warning: null,
      ok: false,
    };
  if (!t.startsWith("EAA"))
    return {
      error: `Tokens válidos começam com "EAA". Confira se copiou o Access Token correto (não a App Secret nem outro código).`,
      warning: null,
      ok: false,
    };
  if (t.length < 100)
    return {
      error: `Token muito curto (${t.length} caracteres). Tokens permanentes da Meta têm cerca de 200 caracteres.`,
      warning: null,
      ok: false,
    };
  if (t.length < 150)
    return {
      error: null,
      warning: `Token com ${t.length} caracteres parece incompleto. Tokens permanentes costumam ter ~200. Copie tudo de novo se algo estiver faltando.`,
      ok: true,
    };
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });
  const [form, setForm] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pingResult, setPingResult] = useState<any>(null);
  const [testTo, setTestTo] = useState("");
  const [testText, setTestText] = useState("Mensagem de teste ✅");
  const [testResult, setTestResult] = useState<any>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<{
    status: string;
    timestamp?: string;
    error?: any;
  } | null>(null);
  const pollRef = useRef<number | null>(null);

  const [crmCollapsed, toggleCrmCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_crm_collapsed",
    true,
  );
  const [legalCollapsed, toggleLegalCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_legal_collapsed",
    true,
  );

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  // Polling do status do teste enquanto houver wamid e ainda não chegou em "read" ou "failed"
  useEffect(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const wamid = testResult?.wa_message_id;
    if (!wamid) return;
    const tick = async () => {
      try {
        const r = await fetchStatus({ data: { wamid } });
        if (r.found) {
          setDeliveryStatus({ status: r.status, timestamp: r.timestamp, error: r.error });
          if (r.status === "read" || r.status === "failed") {
            if (pollRef.current) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
      } catch {}
    };
    tick();
    pollRef.current = window.setInterval(tick, 4000) as unknown as number;
    // Para de tentar após 2 minutos
    const stop = window.setTimeout(() => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 120_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      window.clearTimeout(stop);
    };
  }, [testResult?.wa_message_id, fetchStatus]);

  const saveMut = useMutation({
    mutationFn: (d: any) => save({ data: d }),
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: () => rotate(),
    onSuccess: (d) => {
      toast.success("Chave de API atualizada");
      setForm((f: any) => ({ ...f, api_key: d.api_key }));
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
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
    onError: (e: any) => {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    },
  });

  const helloMut = useMutation({
    mutationFn: (d: { to: string }) => sendHello({ data: d }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success(`Template hello_world enviado para ${r.sent_to}`);
      else toast.error(r.error ?? "Falha ao enviar template");
    },
    onError: (e: any) => {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    },
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
      <PageHeader
        title="Configurações"
        subtitle="Conecte sua conta do WhatsApp Business em poucos passos. Não se preocupe se nunca fez isso antes — explicamos cada campo."
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AppearanceCard />
        <SetupWizard
          credentialsComplete={
            !!(form.whatsapp_phone_number_id && form.whatsapp_waba_id && form.whatsapp_access_token)
          }
          webhookComplete={!!(form.whatsapp_verify_token && form.whatsapp_app_secret)}
          testComplete={!!testResult?.ok}
        >
          {(step) => (
            <>
              {step === 0 && (
                <Card className="p-6 space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      1
                    </div>
                    <div className="flex-1">
                      <h2 className="font-display text-lg font-semibold">
                        Etapa 1: Conectar suas credenciais da Meta (Facebook)
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        Preencha os campos abaixo com os dados do painel de desenvolvedor do Facebook.
                        <br />
                        <span className="text-xs">
                          👉 Se você ainda não tem uma conta, acesse{" "}
                          <a
                            href="https://business.facebook.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline font-medium hover:text-primary/80"
                          >
                            business.facebook.com
                          </a>{" "}
                          para criar o seu gerenciador de negócios.
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Alerta de Cuidado para Iniciantes */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-900 dark:text-blue-200">
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>💡 Dica de Ouro para evitar erros de configuração:</span>
                    </div>
                    <p className="leading-relaxed">
                      Os IDs solicitados abaixo são códigos compostos <strong>apenas por números</strong> (geralmente com 15 a 17 dígitos). 
                      <strong className="text-foreground"> Nunca coloque letras ou o seu número de telefone celular nestes campos.</strong> 
                      Confira com atenção qual ID é qual para evitar erros ao disparar mensagens.
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Field
                      label="ID do Número de Telefone"
                      sublabel="(Phone Number ID)"
                      digitsOnly
                      value={form.whatsapp_phone_number_id}
                      onChange={(v) => {
                        const { error } = validateMetaId(v, "Phone Number ID");
                        setErrors((e) => ({ ...e, whatsapp_phone_number_id: error }));
                        setForm({ ...form, whatsapp_phone_number_id: v });
                      }}
                      placeholder="Ex: 106500000000000"
                      hint={
                        "📍 Onde encontrar: No painel da Meta → WhatsApp → Configuração da API. Fica listado como 'ID do número de telefone' (um código longo de 15 dígitos).\n👉 Copie clicando no botão ao lado do ID no painel da Meta.\n🚨 ATENÇÃO: NÃO coloque seu número de telefone aqui! Digite o ID gerado pelo Facebook."
                      }
                      success={
                        validateMetaId(
                          String(form.whatsapp_phone_number_id ?? ""),
                          "Phone Number ID",
                        ).ok
                          ? `Formato correto · ${String(form.whatsapp_phone_number_id).length} dígitos`
                          : null
                      }
                      error={errors.whatsapp_phone_number_id}
                      copyLabel="Phone Number ID"
                      metaUrl="https://business.facebook.com/wa/manage/phone-numbers/"
                    />

                    <Field
                      label="ID da Conta WhatsApp Business"
                      sublabel="(WABA ID)"
                      digitsOnly
                      value={form.whatsapp_waba_id}
                      onChange={(v) => {
                        const { error } = validateMetaId(v, "WABA ID");
                        setErrors((e) => ({ ...e, whatsapp_waba_id: error }));
                        setForm({ ...form, whatsapp_waba_id: v });
                      }}
                      placeholder="Ex: 112300000000000"
                      hint={
                        "📍 Onde encontrar: No painel da Meta → WhatsApp → Configuração da API. Fica listado logo abaixo do Phone Number ID como 'ID da conta do WhatsApp Business'.\n🚨 CUIDADO: Este ID identifica a sua CONTA de negócios inteira, não um número específico. É diferente do Phone Number ID."
                      }
                      success={
                        validateMetaId(String(form.whatsapp_waba_id ?? ""), "WABA ID").ok
                          ? `Formato correto · ${String(form.whatsapp_waba_id).length} dígitos`
                          : null
                      }
                      error={errors.whatsapp_waba_id}
                      copyLabel="WABA ID"
                      metaUrl="https://business.facebook.com/wa/manage/account/"
                    />

                    <Field
                      label="Meta App ID (ID do Aplicativo Meta)"
                      sublabel="(Necessário para Foto de Perfil)"
                      digitsOnly
                      value={form.whatsapp_app_id}
                      onChange={(v) => {
                        const { error } = validateMetaId(v, "Meta App ID");
                        setErrors((e) => ({ ...e, whatsapp_app_id: error }));
                        setForm({ ...form, whatsapp_app_id: v });
                      }}
                      placeholder="Ex: 123456789012345"
                      hint={
                        "📍 Onde encontrar: developers.facebook.com → Meus Apps → selecione o seu App → copie o ID do aplicativo no topo da página.\n🔒 Necessário para realizar o upload e atualização da imagem de perfil no WhatsApp."
                      }
                      success={
                        validateMetaId(String(form.whatsapp_app_id ?? ""), "Meta App ID").ok
                          ? `Formato correto · ${String(form.whatsapp_app_id).length} dígitos`
                          : null
                      }
                      error={errors.whatsapp_app_id}
                      copyLabel="Meta App ID"
                      metaUrl="https://developers.facebook.com/apps/"
                    />

                    <Field
                      label="ID da Conta de Negócios (Business ID)"
                      sublabel="(Meta Business ID)"
                      digitsOnly
                      value={form.whatsapp_business_id}
                      onChange={(v) => {
                        const { error } = validateMetaId(v, "Business ID");
                        setErrors((e) => ({ ...e, whatsapp_business_id: error }));
                        setForm({ ...form, whatsapp_business_id: v });
                      }}
                      placeholder="Ex: 104500000000000"
                      hint={
                        "📍 Onde encontrar: Acesse o painel Meta Business Suite (business.facebook.com) → Configurações da empresa → Informações da empresa. O código está listado como 'ID do Gerenciador de Negócios'."
                      }
                      success={
                        validateMetaId(String(form.whatsapp_business_id ?? ""), "Business ID").ok
                          ? `Formato correto · ${String(form.whatsapp_business_id).length} dígitos`
                          : null
                      }
                      error={errors.whatsapp_business_id}
                      copyLabel="Business ID"
                      metaUrl="https://business.facebook.com/settings/info"
                    />

                    <Field
                      label="Seu Número do WhatsApp"
                      sublabel="(Apenas identificação visual)"
                      value={form.whatsapp_business_phone}
                      onChange={(v) => setForm({ ...form, whatsapp_business_phone: v })}
                      placeholder="5511999990000"
                      hint="O número de telefone ativo da sua conta. Digite com DDI do país (55 para Brasil), DDD e o número completo. Ex: 5511999990000"
                    />

                    <Field
                      label="Velocidade de Envio"
                      sublabel="(Mensagens por segundo)"
                      type="number"
                      value={form.rate_limit_per_second?.toString() ?? "20"}
                      onChange={(v) => setForm({ ...form, rate_limit_per_second: Number(v) })}
                      hint="Recomendamos manter em 20. Altere somente se a sua conta na Meta tiver autorização para limites de velocidade superiores."
                    />

                    <div className="md:col-span-2 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="flex items-baseline gap-2">
                          <span className="font-semibold">Token de Acesso Permanente (System User Token)</span>
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
                            <a
                              href="https://business.facebook.com/settings/system-users"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Configurações do Negócio
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDebugToken()}
                            disabled={
                              debugTokenMut.isPending || !(form.whatsapp_access_token ?? "").trim()
                            }
                            title="Verificar validade e permissões do token"
                          >
                            {debugTokenMut.isPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Testar Validade do Token
                          </Button>
                        </div>
                      </div>

                      {/* Alerta explicativo de Token Permanente vs Temporário */}
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>⚠️ Super Importante: Não use o Token Temporário!</span>
                        </div>
                        <p className="mb-3 leading-relaxed">
                          O painel da Meta oferece um token que expira em 24 horas. Se você usar esse token, o sistema vai parar de funcionar amanhã! 
                          Você deve gerar um <strong>Token Permanente</strong> seguindo o passo a passo abaixo:
                        </p>
                        <ol className="list-decimal pl-5 space-y-1.5 font-medium leading-relaxed">
                          <li>Vá em <strong>Configurações do Negócio</strong> → <strong>Usuários do Sistema</strong> (System Users).</li>
                          <li>Clique em <strong>Adicionar</strong>, crie um usuário com função de <strong>Administrador</strong> (Admin).</li>
                          <li>Selecione este usuário criado e clique em <strong>Gerar Novo Token</strong>.</li>
                          <li>Selecione o seu aplicativo na lista e marque obrigatoriamente as permissões: <code className="text-[10px] bg-background px-1 py-0.5 rounded">whatsapp_business_messaging</code> e <code className="text-[10px] bg-background px-1 py-0.5 rounded">whatsapp_business_management</code>.</li>
                          <li>Defina a expiração como <strong>Sem Expiração (Never)</strong>.</li>
                          <li>Gere o token, copie o código longo (começa com <code className="text-[10px] font-bold">EAA...</code>) e cole abaixo.</li>
                        </ol>
                      </div>

                      {(() => {
                        const tokenValue = form.whatsapp_access_token ?? "";
                        const v = validateAccessToken(tokenValue);
                        return (
                          <>
                            <Textarea
                              rows={4}
                              value={tokenValue}
                              onChange={(e) =>
                                setForm({ ...form, whatsapp_access_token: e.target.value })
                              }
                              placeholder="Cole o token permanente longo aqui (EAA...)"
                              className={cn(
                                "font-mono text-xs leading-relaxed",
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
                              <p className="flex items-center gap-1.5 text-xs text-success font-medium">
                                <Check className="h-3.5 w-3.5" />
                                Token formatado corretamente ({tokenValue.trim().length} caracteres)
                              </p>
                            )}

                            {debugResult && (
                              <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-xs">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="font-semibold text-foreground">
                                    Diagnóstico do Token (Meta API)
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      debugResult.is_valid
                                        ? "bg-success/15 text-success hover:bg-success/20 border-none"
                                        : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-none",
                                    )}
                                  >
                                    {debugResult.is_valid ? "Válido" : "Inválido"}
                                  </Badge>
                                </div>
                                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                                  <p className="text-muted-foreground">
                                    ID do App:{" "}
                                    <span className="font-mono text-foreground font-medium">
                                      {debugResult.app_id}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Aplicação:{" "}
                                    <span className="text-foreground font-medium">
                                      {debugResult.application}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Expira em:{" "}
                                    <span className="text-foreground font-medium">
                                      {debugResult.expires_at === 0
                                        ? "Nunca"
                                        : new Date(debugResult.expires_at * 1000).toLocaleString()}
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Tipo de Usuário:{" "}
                                    <span className="text-foreground font-medium">
                                      {debugResult.type}
                                    </span>
                                  </p>
                                </div>
                                {debugResult.scopes && (
                                  <div className="pt-2 border-t space-y-1">
                                    <p className="font-medium text-foreground">
                                      Permissões (Scopes):
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {debugResult.scopes.map((s: string) => (
                                        <Badge
                                          key={s}
                                          variant="outline"
                                          className={cn(
                                            [
                                              "whatsapp_business_messaging",
                                              "whatsapp_business_management",
                                            ].includes(s)
                                              ? "bg-success/10 text-success border-success/20"
                                              : "bg-muted text-muted-foreground",
                                          )}
                                        >
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
                    <Button
                      onClick={() => {
                        const nextErrors: Record<string, string | null> = {};
                        const err1 = validateDigitsField(
                          String(form.whatsapp_phone_number_id ?? ""),
                          "ID do número de telefone",
                        );
                        if (err1) nextErrors.whatsapp_phone_number_id = err1;
                        const err2 = validateDigitsField(
                          String(form.whatsapp_waba_id ?? ""),
                          "ID da conta WhatsApp Business",
                        );
                        if (err2) nextErrors.whatsapp_waba_id = err2;
                        
                        const appIdValue = String(form.whatsapp_app_id ?? "").trim();
                        if (appIdValue && /\D/.test(appIdValue)) {
                          nextErrors.whatsapp_app_id = "App ID deve conter apenas dígitos.";
                        }

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
                          whatsapp_app_id: form.whatsapp_app_id || null,
                          rate_limit_per_second: form.rate_limit_per_second,
                        });
                      }}
                      disabled={saveMut.isPending}
                    >
                      Salvar e conectar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Pré-validação: identifica EXATAMENTE quais campos faltam ou estão inválidos
                        const checks: { key: string; label: string; problem: string | null }[] = [];
                        const phoneId = String(form.whatsapp_phone_number_id ?? "").trim();
                        const wabaId = String(form.whatsapp_waba_id ?? "").trim();
                        const token = String(form.whatsapp_access_token ?? "").trim();

                        checks.push({
                          key: "whatsapp_phone_number_id",
                          label: "ID do número de telefone",
                          problem: !phoneId
                            ? "está vazio"
                            : validateDigitsField(phoneId, "ID do número de telefone"),
                        });
                        checks.push({
                          key: "whatsapp_waba_id",
                          label: "ID da conta WhatsApp Business (WABA ID)",
                          problem: !wabaId
                            ? "está vazio"
                            : validateDigitsField(wabaId, "ID da conta WhatsApp Business"),
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
                          missing.forEach((m) => {
                            nextErrors[m.key] = m.problem!;
                          });
                          setErrors(nextErrors);
                          setPingResult({
                            ok: false,
                            error:
                              missing.length === 1
                                ? `Falta preencher: ${missing[0].label}.`
                                : `Faltam ${missing.length} campos para testar a conexão.`,
                            missingFields: missing.map((m) => ({
                              label: m.label,
                              problem: m.problem,
                            })),
                          });
                          toast.error(
                            missing.length === 1
                              ? `Preencha: ${missing[0].label}`
                              : `${missing.length} campos pendentes`,
                          );
                          return;
                        }
                        setPingResult(null);
                        pingMut.mutate();
                      }}
                      disabled={pingMut.isPending}
                    >
                      {pingMut.isPending ? "Testando…" : "Testar agora"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    💡 Clique em <strong>"Testar agora"</strong> depois de salvar — vamos verificar
                    a conexão e dizer exatamente o que está faltando, se faltar algo.
                  </p>
                  {pingResult && (
                    <ResultAlert
                      ok={!!pingResult.ok}
                      successContent={
                        <span>
                          Tudo certo! Conectado a <strong>{pingResult.info?.verified_name}</strong>{" "}
                          ({pingResult.info?.display_phone_number}) · qualidade do número:{" "}
                          {pingResult.info?.quality_rating}
                        </span>
                      }
                      error={pingResult.error}
                      details={
                        pingResult.missingFields ? (
                          <div className="space-y-1">
                            <p className="font-medium">Campos com problema:</p>
                            <ul className="list-disc pl-5 space-y-0.5">
                              {pingResult.missingFields.map((f: any, i: number) => (
                                <li key={i}>
                                  <strong>{f.label}</strong> — {f.problem}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          (pingResult.details ?? pingResult.error)
                        )
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
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        A API pode aceitar e mesmo assim a mensagem não chegar.
                      </p>
                      <p className="text-amber-900/80 dark:text-amber-200/80">
                        Para mensagens de <strong>texto livre</strong> (como este teste), o
                        destinatário precisa ter te enviado uma mensagem nas{" "}
                        <strong>últimas 24h</strong>. Fora dessa janela, a Meta confirma o
                        recebimento (retorna um <code className="text-xs">wamid</code>) mas{" "}
                        <strong>não entrega</strong>.
                      </p>
                      <p className="text-amber-900/80 dark:text-amber-200/80">
                        Se sua conta WhatsApp Business ainda está em modo de teste/desenvolvimento,
                        o número também precisa estar cadastrado em{" "}
                        <em>WhatsApp Manager → Phone Numbers → Test recipients</em>. Para envios
                        fora da janela, use um <strong>template aprovado</strong>.
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
                        if (testTo.length < 8) {
                          toast.error("Informe um número válido (apenas dígitos).");
                          return;
                        }
                        if (!testText.trim()) {
                          toast.error("Escreva a mensagem.");
                          return;
                        }
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
                        if (testTo.length < 8) {
                          toast.error("Informe um número válido (apenas dígitos).");
                          return;
                        }
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
                    💡 <strong>Não chegou nada?</strong> Use o <strong>hello_world</strong> — é um
                    template oficial da Meta que ignora a janela de 24h. Se esse chegar e o texto
                    livre não, é confirmação de que o problem é a janela.
                  </p>

                  {testResult && (
                    <>
                      <ResultAlert
                        ok={!!testResult.ok}
                        successContent={
                          <span>
                            Aceito pela Meta para <strong>{testResult.sent_to}</strong>
                            {testResult.wa_message_id ? (
                              <>
                                {" "}
                                · id <code className="text-xs">{testResult.wa_message_id}</code>
                              </>
                            ) : null}
                          </span>
                        }
                        error={testResult.error}
                        details={testResult.details}
                        fallback="Falha ao enviar a mensagem de teste."
                      />
                      {testResult.ok && (
                        <DeliveryTimeline
                          status={deliveryStatus}
                          hasWebhook={!!form.whatsapp_app_secret && !!form.whatsapp_verify_token}
                        />
                      )}
                    </>
                  )}
                </Card>
              )}

              {step === 1 && (
                <Card className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      2
                    </div>
                    <div className="flex-1">
                      <h2 className="font-display text-lg font-semibold">
                        Receber confirmações da Meta (webhook)
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Isso permite saber quando suas mensagens foram{" "}
                        <strong>entregues e lidas</strong>. No painel da Meta, vá em{" "}
                        <strong>App Dashboard → WhatsApp → Configuration</strong> e cole os dados
                        abaixo. Marque a opção <code className="text-xs">messages</code>.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <ReadOnly
                      label="1. Cole esta URL no campo 'Callback URL' da Meta"
                      value={webhookUrl}
                      onCopy={() => copy(webhookUrl, "URL do webhook")}
                    />
                    <div className="space-y-1.5">
                      <Label className="flex items-baseline gap-2">
                        <span>2. Crie uma palavra secreta</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          (Verify Token)
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.whatsapp_verify_token ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, whatsapp_verify_token: e.target.value })
                          }
                          placeholder="ex: meu_token_super_secreto_123"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(form.whatsapp_verify_token ?? "");
                            toast.success("Verify Token copiado");
                          }}
                          title="Copiar Verify Token"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() =>
                            saveMut.mutate({ whatsapp_verify_token: form.whatsapp_verify_token })
                          }
                        >
                          Salvar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Pode ser qualquer texto que só você sabe. Depois cole o{" "}
                        <strong>mesmo valor</strong> no campo "Verify token" da Meta.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-baseline gap-2">
                        <span>3. Cole a Chave Secreta do App</span>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          (App Secret)
                        </span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={form.whatsapp_app_secret ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, whatsapp_app_secret: e.target.value })
                          }
                          placeholder="Cole aqui o App Secret"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(form.whatsapp_app_secret ?? "");
                            toast.success("App Secret copiado");
                          }}
                          title="Copiar App Secret"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" asChild title="Abrir na Meta">
                          <a
                            href="https://developers.facebook.com/apps/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          onClick={() =>
                            saveMut.mutate({ whatsapp_app_secret: form.whatsapp_app_secret })
                          }
                        >
                          Salvar
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        No painel da Meta:{" "}
                        <strong>Configurações → Básico → Chave Secreta do App</strong>. Usado para
                        confirmar que cada aviso veio mesmo da Meta.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </SetupWizard>

        <WebhookHealthCard />

        <AdminPlatformSection />

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">
                Conectar com outros sistemas (CRM, automações)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use a chave abaixo para receber contatos automaticamente do seu CRM (HubSpot, RD
                Station, n8n, Zapier, etc). Se nunca usou isso, pode ignorar esta seção — não é
                obrigatório para enviar mensagens.
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
              {crmCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs">
                {crmCollapsed ? "Expandir" : "Recolher"}
              </span>
            </Button>
          </div>
          {!crmCollapsed && (
            <div className="mt-4 space-y-3">
              <ReadOnly
                label="Endereço para envio (POST)"
                value={ingestUrl}
                onCopy={() => copy(ingestUrl, "Endpoint")}
              />
              <div className="space-y-1.5">
                <Label>Sua chave de acesso</Label>
                <div className="flex gap-2">
                  <Input readOnly value={form.api_key ?? ""} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    onClick={() => copy(form.api_key ?? "", "API key")}
                    title="Copiar"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => rotateMut.mutate()}
                    disabled={rotateMut.isPending}
                    title="Gerar nova chave (a antiga deixa de funcionar)"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Trate como uma senha — qualquer pessoa com essa chave pode enviar contatos para
                  sua conta.
                </p>
              </div>
              <details className="rounded-md border bg-muted/30 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-foreground">
                  Exemplo técnico para desenvolvedores
                </summary>
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

        <AdvancedToolsSection />

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Documentos legais</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Leia nossos termos e saiba como seus dados são tratados.
              </p>
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
              {legalCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs">
                {legalCollapsed ? "Expandir" : "Recolher"}
              </span>
            </Button>
          </div>
          {!legalCollapsed && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                to="/privacy"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Shield className="h-4 w-4 text-primary" />
                Política de Privacidade
              </Link>
              <Link
                to="/terms"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-primary" />
                Termos de Serviço
              </Link>
              <Link
                to="/data-deletion"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
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
    isComplete,
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
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {progress}%
            </span>
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
              <span className="hidden sm:inline text-xs">
                {collapsed ? "Expandir" : "Recolher"}
              </span>
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
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s.done
                        ? "bg-success text-success-foreground"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      Etapa {i + 1}
                    </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground">
              {steps[step].done ? "Etapa concluída ✓" : "Preencha os campos desta etapa"}
            </span>
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              disabled={step === steps.length - 1}
            >
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
    true,
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
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize o tema do painel. A mudança é aplicada imediatamente.
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${isSystem ? "bg-primary/10" : "bg-muted"}`}>
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Tema atual:{" "}
                <span className="capitalize">{theme === "dark" ? "Escuro" : "Claro"}</span>
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

function DeliveryTimeline({
  status,
  hasWebhook,
}: {
  status: { status: string; timestamp?: string; error?: any } | null;
  hasWebhook: boolean;
}) {
  if (!hasWebhook) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Para acompanhar <strong>entregue / lido</strong> em tempo real, configure abaixo o{" "}
          <strong>App Secret</strong> + <strong>Verify Token</strong> e cadastre a Callback URL no
          painel da Meta (campo <code>messages</code>).
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
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Status real (via webhook da Meta)
      </div>
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
        <div className="mt-2 text-[11px] text-muted-foreground">
          Última atualização: {new Date(status.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function Step({
  label,
  active,
  icon: Icon,
  accent,
}: {
  label: string;
  active: boolean;
  icon: any;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 ${active ? (accent ? "text-primary" : "text-success") : "text-muted-foreground/50"}`}
    >
      <Icon className="h-4 w-4" />
      <span className={active ? "font-medium" : ""}>{label}</span>
    </div>
  );
}

function Divider({ active }: { active: boolean }) {
  return <div className={`h-px w-6 ${active ? "bg-success" : "bg-border"}`} />;
}

function Field({
  label,
  sublabel,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  digitsOnly,
  error,
  success,
  metaUrl,
  copyLabel,
}: {
  label: string;
  sublabel?: string;
  hint?: React.ReactNode;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  digitsOnly?: boolean;
  error?: string | null;
  success?: string | null;
  metaUrl?: string;
  copyLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-baseline gap-2">
        <span>{label}</span>
        {sublabel && (
          <span className="text-[11px] font-normal text-muted-foreground">{sublabel}</span>
        )}
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(String(value ?? ""));
              toast.success(`${copyLabel} copiado`);
            }}
            title={`Copiar ${copyLabel}`}
          >
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
      {hint && !error && !success && (
        <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

function ReadOnly({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button variant="outline" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const MENU_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat Direto", icon: MessageCircle },
  { to: "/contacts", label: "Contatos", icon: Users },
  { to: "/lists", label: "Listas & Tags", icon: ListChecks },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns", label: "Campanhas", icon: Send },
  { to: "/crm", label: "Funil de Vendas", icon: Kanban },
  { to: "/billing", label: "Faturamento", icon: Receipt },
  { to: "/settings", label: "Configurações", icon: Settings },
];

function AdminPlatformSection() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const fetchSettings = useServerFn(getPlatformSettings);
  const saveSettings = useServerFn(updatePlatformSettings);
  const fetchSidebarOrder = useServerFn(getSidebarOrder);
  const saveSidebarOrder = useServerFn(updateSidebarOrder);
  const qc = useQueryClient();

  const { data: roleData } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const isAdmin = roleData?.isAdmin === true;

  const { data: sidebarOrderData } = useQuery({
    queryKey: ["sidebar-order"],
    queryFn: () => fetchSidebarOrder(),
    enabled: isAdmin,
  });

  const [localNavOrder, setLocalNavOrder] = useState<any[]>([]);
  const [sidebarOrderCollapsed, toggleSidebarOrderCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_sidebar_order_collapsed",
    true,
  );
  const [savingSidebar, setSavingSidebar] = useState(false);

  useEffect(() => {
    if (sidebarOrderData) {
      const order = sidebarOrderData.order;
      if (order) {
        try {
          const parsed = JSON.parse(order) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sorted = [...MENU_ITEMS].sort((a, b) => {
              const idxA = parsed.indexOf(a.to);
              const idxB = parsed.indexOf(b.to);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
            setLocalNavOrder(sorted);
            return;
          }
        } catch {}
      }
    }
    setLocalNavOrder([...MENU_ITEMS]);
  }, [sidebarOrderData]);

  const moveItem = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= localNavOrder.length) return;

    const updated = [...localNavOrder];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setLocalNavOrder(updated);
  };

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
    true,
  );
  const [tagsCollapsed, toggleTagsCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_custom_tags_collapsed",
    true,
  );
  const [cronCollapsed, toggleCronCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_cron_secret_collapsed",
    true,
  );
  const [credsCollapsed, toggleCredsCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_meta_creds_collapsed",
    true,
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
            <h2 className="font-display text-lg font-semibold">
              Plataforma Meta (Tech Provider / ISV)
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Lock className="h-3 w-3" /> Admin Master
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Credenciais globais do <strong>seu</strong> App Meta. Compartilhadas por toda a
            plataforma — habilitam o botão "Conectar com o Facebook" (Embedded Signup) para todos os
            clientes.
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
                {credsCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
                <span className="hidden sm:inline text-xs">
                  {credsCollapsed ? "Expandir" : "Recolher"}
                </span>
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
                  <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
                    {
                      '📍 developers.facebook.com → Meus Apps → selecione o App → o número aparece no topo da página, abaixo do nome do App ("ID do aplicativo").\n⚠️ Não confunda com o Business ID nem com o WABA ID.'
                    }
                  </p>
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
                  <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
                    {
                      "📍 developers.facebook.com → seu App → WhatsApp → Configuração → role até 'Registro incorporado' (Embedded Signup) → 'Configurações' → copie o ID da configuração.\n💡 É o ID do fluxo de onboarding que abre quando o cliente clica em 'Conectar com o Facebook'."
                    }
                  </p>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label>App Secret</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PasswordInput
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                        placeholder={
                          settings?.meta_app_secret_set
                            ? "•••••••••••••••• (já configurado — deixe vazio para manter)"
                            : "Cole aqui o App Secret"
                        }
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
                    {
                      "📍 developers.facebook.com → seu App → Configurações → Básico → campo 'Chave Secreta do App' → clique em 'Mostrar' (vai pedir sua senha do Facebook).\n🔒 Usado para validar a assinatura dos webhooks da Meta. Nunca compartilhe esse valor."
                    }
                    {settings?.meta_app_secret_set && (
                      <span className="block mt-1 text-success font-medium">
                        ✓ Atualmente configurado
                      </span>
                    )}
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
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <p className="text-[11px] text-muted-foreground">
                    {settings?.updated_at && (
                      <>Última atualização: {new Date(settings.updated_at).toLocaleString()}</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-display text-base font-semibold">
                  Tags personalizadas (Analytics, Pixel, etc.)
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cole snippets completos (com <code className="text-xs">&lt;script&gt;</code>,{" "}
                  <code className="text-xs">&lt;meta&gt;</code>,{" "}
                  <code className="text-xs">&lt;noscript&gt;</code>…). Eles serão injetados em{" "}
                  <strong>todas as páginas</strong> da plataforma para todos os usuários.
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
                {tagsCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
                <span className="hidden sm:inline text-xs">
                  {tagsCollapsed ? "Expandir" : "Recolher"}
                </span>
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
                  <p className="text-[11px] text-muted-foreground">
                    Ideal para Google Analytics, GTM, Meta Pixel, verificações de domínio, etc.
                  </p>
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
                  <p className="text-[11px] text-muted-foreground">
                    Ideal para widgets, scripts que dependem do DOM carregado, fallbacks
                    &lt;noscript&gt;.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-display text-base font-semibold">
                  Segredo do Cron (CRON_SECRET)
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Token usado para autenticar o agendador (pg_cron) ao chamar{" "}
                  <code className="text-xs">/api/public/cron/process-queue</code>. Se vazio, o
                  endpoint fica <strong>aberto</strong> (apenas para testes).
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
                {cronCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
                <span className="hidden sm:inline text-xs">
                  {cronCollapsed ? "Expandir" : "Recolher"}
                </span>
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
                        const token = Array.from(bytes)
                          .map((b) => b.toString(16).padStart(2, "0"))
                          .join("");
                        setCronSecret(token);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" /> Gerar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!cronSecret}
                      onClick={() => {
                        navigator.clipboard.writeText(cronSecret);
                        toast.success("Copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Após salvar, envie este valor no header{" "}
                  <code className="text-[10px]">x-cron-secret</code> em cada chamada do cron.
                </p>
              </>
            )}
          </div>

          <div className="mt-6 border-t pt-5">
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" /> Backups do schema do banco
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Um backup automático do schema <code className="text-xs">public</code> é gerado
              diariamente às 03:00 (UTC). Você também pode gerar um backup manual a qualquer
              momento. As 30 versões mais recentes ficam disponíveis para download.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ExportSchemaButton />
            </div>
            <SchemaBackupsHistory />
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-display text-base font-semibold flex items-center gap-2">
                  Organização do Menu Lateral
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reorganize os itens do menu lateral usando as setas. As alterações afetam todos os usuários da plataforma.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSidebarOrderCollapsed}
                aria-expanded={!sidebarOrderCollapsed}
                aria-label={sidebarOrderCollapsed ? "Expandir seção de menu" : "Recolher seção de menu"}
                className="shrink-0 gap-1 mt-0.5"
              >
                {sidebarOrderCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
                <span className="hidden sm:inline text-xs">
                  {sidebarOrderCollapsed ? "Expandir" : "Recolher"}
                </span>
              </Button>
            </div>

            {!sidebarOrderCollapsed && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controles de reordenação */}
                <div className="space-y-2 rounded-xl border bg-muted/15 p-4">
                  <div className="text-sm font-semibold mb-3 text-foreground">Reordenar Itens</div>
                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                    {localNavOrder.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.to}
                          className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-foreground leading-snug">{item.label}</div>
                              <div className="text-[10px] text-muted-foreground leading-none">{item.to}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md"
                              disabled={idx === 0}
                              onClick={() => moveItem(idx, "up")}
                              title="Mover para cima"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md"
                              disabled={idx === localNavOrder.length - 1}
                              onClick={() => moveItem(idx, "down")}
                              title="Mover para baixo"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-4 mt-2 border-t">
                    <Button
                      size="sm"
                      onClick={async () => {
                        setSavingSidebar(true);
                        try {
                          const paths = localNavOrder.map((item) => item.to);
                          const res = await saveSidebarOrder({ data: { order: JSON.stringify(paths) } });
                          if (!res.ok) throw new Error("Erro de resposta do servidor");
                          toast.success("Ordem do menu lateral salva!");
                          qc.invalidateQueries({ queryKey: ["sidebar-order"] });
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao salvar");
                        } finally {
                          setSavingSidebar(false);
                        }
                      }}
                      disabled={savingSidebar}
                    >
                      {savingSidebar ? "Salvando..." : "Salvar Nova Ordem"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm("Deseja restaurar a ordem padrão do menu?")) return;
                        setSavingSidebar(true);
                        try {
                          const res = await saveSidebarOrder({ data: { order: null } });
                          if (!res.ok) throw new Error("Erro de resposta do servidor");
                          toast.success("Ordem padrão restaurada!");
                          setLocalNavOrder([...MENU_ITEMS]);
                          qc.invalidateQueries({ queryKey: ["sidebar-order"] });
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao restaurar");
                        } finally {
                          setSavingSidebar(false);
                        }
                      }}
                      disabled={savingSidebar}
                    >
                      Restaurar Padrão
                    </Button>
                  </div>
                </div>

                {/* Pré-visualização em tempo real */}
                <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-6 border-dashed">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4 self-start">
                    Visualização em Tempo Real (Preview)
                  </div>

                  <div className="w-[230px] rounded-xl border bg-sidebar p-3 text-sidebar-foreground shadow-lg flex flex-col text-left">
                    <div className="flex items-center gap-2 px-3 py-2 mb-3 border-b border-sidebar-border/30">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary">
                        <MessageCircle className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
                      </div>
                      <span className="font-display text-xs font-semibold text-sidebar-foreground">
                        ZapDispatch
                      </span>
                    </div>

                    <div className="px-3 pb-1.5 text-[9px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
                      Menu
                    </div>

                    <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-1">
                      {localNavOrder.map((item, index) => {
                        const Icon = item.icon;
                        const active = index === 0;
                        const isSettings = item.to === "/settings";

                        if (isSettings) {
                          return (
                            <div key={item.to} className="space-y-0.5">
                              <div
                                className={cn(
                                  "relative flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors text-sidebar-foreground/75"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5 text-sidebar-foreground/75" />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                <ChevronDown className="h-3 w-3 text-sidebar-foreground/45" />
                              </div>
                              <div className="pl-4 space-y-0.5 border-l border-sidebar-border/30 ml-4 mt-0.5">
                                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                                  <Settings className="h-3 w-3 text-sidebar-accent-foreground" />
                                  <span>Geral</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/60">
                                  <UserCog className="h-3 w-3 text-sidebar-foreground/60" />
                                  <span>Perfil WhatsApp</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/60">
                                  <ShieldCheck className="h-3 w-3 text-sidebar-foreground/60" />
                                  <span>Usuários</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/60">
                                  <ScrollText className="h-3 w-3 text-sidebar-foreground/60" />
                                  <span>Auditoria</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/60">
                                  <Activity className="h-3 w-3 text-sidebar-foreground/60" />
                                  <span>Eventos do Webhook</span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.to}
                            className={cn(
                              "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground/75"
                            )}
                          >
                            {active && (
                              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                            )}
                            <Icon className={cn("h-3.5 w-3.5", active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/75")} />
                            <span className="truncate">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground mt-4 text-center leading-relaxed">
                    💡 O primeiro item da lista é mostrado como ativo nesta pré-visualização.
                    <br />
                    As alterações são aplicadas a todos os usuários após salvar.
                  </div>
                </div>
              </div>
            )}
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
            <p>
              • App em modo <strong>Live</strong> (não Development)
            </p>
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

  const {
    data: health,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["webhook-health"],
    queryFn: () => fetchHealth(),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_webhook_health_collapsed",
    true,
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

  const statusLabel = fresh
    ? "Recebendo eventos"
    : stale
      ? "Sem eventos há +24h"
      : "Nunca recebeu eventos";

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
                <div
                  className={cn(
                    "mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-sm font-medium",
                    statusColor,
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      fresh
                        ? "bg-success animate-pulse"
                        : stale
                          ? "bg-amber-500"
                          : "bg-destructive",
                    )}
                  />
                  {statusLabel}
                </div>
                {last && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Último em {last.toLocaleString()} ({formatAge(ageMs!)})
                  </div>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Últimas 24h
                </div>
                <div className="mt-2 text-2xl font-semibold">{health?.events_last_24h ?? 0}</div>
                <div className="text-xs text-muted-foreground">eventos recebidos</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Pendentes
                </div>
                <div className="mt-2 text-2xl font-semibold">{health?.unprocessed_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">eventos não processados</div>
              </div>
            </div>
          )}

          {never && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              ⚠️ Nenhum evento foi recebido ainda. Verifique se a Callback URL e o Verify Token
              estão configurados na Meta e se o webhook foi inscrito no campo <code>messages</code>.
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
                        <Badge
                          variant={ev.processed ? "secondary" : "outline"}
                          className="mt-0.5 shrink-0"
                        >
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
    false,
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
              Nenhum backup ainda. O primeiro será gerado automaticamente às 03:00 (UTC), ou clique
              em "Gerar backup agora".
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
                        {b.source === "manual" ? "Manual" : "Automático"} ·{" "}
                        {formatBytes(b.size_bytes)}
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
    true,
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
    mutationFn: (variables: {
      code: string;
      prefilled_message: string;
      generate_qr_image: "PNG" | "SVG";
    }) => updateQR({ data: variables }),
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
              <p className="text-muted-foreground text-sm">
                Nenhum QR Code encontrado nesta conta do WhatsApp.
              </p>
              <Button onClick={openCreateDialog} className="mt-4 gap-1" variant="outline">
                <Plus className="h-4 w-4" /> Criar o Primeiro
              </Button>
            </div>
          )}

          {qrList && qrList.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {qrList.map((qr: any) => (
                <Card
                  key={qr.code}
                  className="overflow-hidden flex flex-col group hover:border-primary/50 transition-all duration-300"
                >
                  <div className="p-4 bg-muted/20 flex justify-center relative min-h-[160px] items-center">
                    {qr.qr_image_url ? (
                      <div className="rounded-xl overflow-hidden shadow-sm bg-white p-2 border hover:scale-105 transition-transform duration-300">
                        <img
                          src={qr.qr_image_url}
                          alt="QR Code"
                          className="w-32 h-32 object-contain"
                        />
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
                        Código:{" "}
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {qr.code}
                        </span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(qr.deep_link_url);
                          toast.success("Link copiado!");
                        }}
                      >
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
                : "Defina uma mensagem que os clientes enviarão automaticamente ao escanear o código."}
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
    true,
  );

  const [searchId, setSearchId] = useState("");
  const [details, setDetails] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [listType, setListType] = useState<"owned" | "client" | "assigned" | null>(null);

  // Estados para Telefones e Webhooks
  const [phonesMap, setPhonesMap] = useState<Record<string, any[]>>({});
  const [loadingPhones, setLoadingPhones] = useState<Record<string, boolean>>({});
  const [subscribing, setSubscribing] = useState<Record<string, boolean>>({});

  // Atribuídas ao Token states
  const fetchAssigned = useServerFn(listAssignedWABAs);
  const [metaUserId, setMetaUserId] = useState<string>("");

  // Onboarding Wizard states
  const requestCode = useServerFn(requestVerificationCode);
  const verifyCode = useServerFn(verifyVerificationCode);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingPhoneId, setOnboardingPhoneId] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Request, 2: Verify, 3: Register
  const [codeMethod, setCodeMethod] = useState<"SMS" | "VOICE" | "IVR">("SMS");
  const [codeLanguage, setCodeLanguage] = useState("pt_BR");
  const [verificationCode, setVerificationCode] = useState("");
  const [twoFactorPin, setTwoFactorPin] = useState("");

  // Settings Gear states
  const getPhoneSettingsFn = useServerFn(getPhoneSettings);
  const updatePhoneSettingsFn = useServerFn(updatePhoneSettings);
  const getOBAStatusFn = useServerFn(getOBAStatus);
  const applyForOBAFn = useServerFn(applyForOBA);
  const getSinglePhoneInfoFn = useServerFn(getSinglePhoneInfo);
  const updatePhoneConfigFn = useServerFn(updatePhoneConfig);
  const fetchDebugToken = useServerFn(debugAccessToken);

  const [phoneSettingsOpen, setPhoneSettingsOpen] = useState(false);
  const [settingsPhoneId, setSettingsPhoneId] = useState("");
  const [settingsTab, setSettingsTab] = useState("general"); // general, calling, oba
  
  // Settings Gear form fields
  const [displayName, setDisplayName] = useState("");
  const [searchVisibility, setSearchVisibility] = useState("PUBLIC");
  const [obaStatus, setObaStatus] = useState<any>(null);
  const [obaCategory, setObaCategory] = useState("OTHER");
  const [obaWebsite, setObaWebsite] = useState("");
  const [obaReason, setObaReason] = useState("");
  const [callingEnabled, setCallingEnabled] = useState(true);
  const [sipEnabled, setSipEnabled] = useState(false);

  // WABA Edit states
  const updateWABAFn = useServerFn(updateWABA);
  const [wabaEditDialogOpen, setWabaEditDialogOpen] = useState(false);
  const [editWabaId, setEditWabaId] = useState("");
  const [editWabaName, setEditWabaName] = useState("");
  const [editWabaTimezone, setEditWabaTimezone] = useState("");

  const openEditWabaDialog = (waba: any) => {
    setEditWabaId(waba.id);
    setEditWabaName(waba.name || "");
    setEditWabaTimezone(waba.timezone_id || "");
    setWabaEditDialogOpen(true);
  };

  const updateWabaMut = useMutation({
    mutationFn: () =>
      updateWABAFn({
        data: {
          wabaId: editWabaId,
          name: editWabaName,
          timezone_id: editWabaTimezone,
        },
      }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("WABA atualizada com sucesso na Meta!");
        setWabaEditDialogOpen(false);
        if (details && details.id === editWabaId) {
          searchMut.mutate(editWabaId);
        }
        if (listType) {
          if (listType === "assigned") {
            listAssignedMut.mutate();
          } else {
            listMut.mutate(listType);
          }
        }
      } else {
        toast.error(res.error || "Falha ao atualizar WABA.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpdateWaba = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWabaName.trim()) {
      toast.error("O nome da WABA é obrigatório.");
      return;
    }
    updateWabaMut.mutate();
  };

  // Deregister phone states & mutations
  const deregisterPhone = useServerFn(deregisterPhoneNumber);
  const deregisterPhoneMut = useMutation({
    mutationFn: (phoneId: string) => deregisterPhone({ data: { phoneId } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("Número desregistrado com sucesso.");
        qc.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast.error(res.error || "Falha ao desregistrar número.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const listAssignedMut = useMutation({
    mutationFn: async () => {
      let currentUserId = metaUserId;
      if (!currentUserId) {
        const token = String(profileData?.whatsapp_access_token ?? "").trim();
        if (!token) throw new Error("Insira e salve o Access Token no Passo 1 antes de usar.");
        const debugRes = await fetchDebugToken({ data: { token } });
        if (!debugRes.ok || !debugRes.data?.user_id) {
          throw new Error(debugRes.error || "Não foi possível resolver o Meta User ID.");
        }
        currentUserId = debugRes.data.user_id;
        setMetaUserId(currentUserId);
      }
      const res = await fetchAssigned({ data: { metaUserId: currentUserId } });
      if (!res.ok) throw new Error(res.error || "Erro ao listar WABAs atribuídas.");
      return res.data || [];
    },
    onSuccess: (data) => {
      setList(data);
      setListType("assigned");
      toast.success(`Carregadas ${data.length} contas WABA atribuídas.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onboardingRequestCodeMut = useMutation({
    mutationFn: () => requestCode({ data: { phoneId: onboardingPhoneId, method: codeMethod, language: codeLanguage } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("Código de verificação solicitado! Confira seu telefone.");
        setOnboardingStep(2);
      } else {
        toast.error(res.error || "Erro ao solicitar código.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onboardingVerifyCodeMut = useMutation({
    mutationFn: () => verifyCode({ data: { phoneId: onboardingPhoneId, code: verificationCode } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("Código de verificação aceito! Defina o PIN de 2FA.");
        setOnboardingStep(3);
      } else {
        toast.error(res.error || "Código incorreto ou expirado.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onboardingRegisterPinMut = useMutation({
    mutationFn: () => registerPhone({ data: { phoneId: onboardingPhoneId, pin: twoFactorPin } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("Número registrado com sucesso!");
        setOnboardingOpen(false);
        // Refresh phone list
        const activeWaba = searchId || details?.id || list.find((w) => phonesMap[w.id])?.id;
        if (activeWaba) loadPhonesMut.mutate(activeWaba);
      } else {
        toast.error(res.error || "Falha ao registrar PIN.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const loadPhoneSettingsMut = useMutation({
    mutationFn: async (phoneId: string) => {
      const [settingsRes, obaRes, infoRes] = await Promise.all([
        getPhoneSettingsFn({ data: { phoneId } }),
        getOBAStatusFn({ data: { phoneId } }).catch(() => ({ ok: true, data: null })),
        getSinglePhoneInfoFn({ data: { phoneId } }),
      ]);
      return {
        settings: settingsRes.ok ? settingsRes.data : null,
        oba: obaRes.ok ? obaRes.data : null,
        info: infoRes.ok ? infoRes.data : null,
      };
    },
    onSuccess: (data) => {
      if (data.info) {
        setDisplayName(data.info.verified_name || "");
      }
      if (data.settings) {
        setCallingEnabled(data.settings.calling_enabled ?? true);
        setSipEnabled(data.settings.sip_enabled ?? false);
      }
      if (data.oba) {
        setObaStatus(data.oba);
      } else {
        setObaStatus(null);
      }
      toast.success("Configurações do telefone carregadas!");
    },
    onError: (e: any) => toast.error("Erro ao carregar configurações: " + e.message),
  });

  const savePhoneSettingsMut = useMutation({
    mutationFn: async () => {
      await updatePhoneSettingsFn({
        data: {
          phoneId: settingsPhoneId,
          payload: {
            calling_enabled: callingEnabled,
            sip_enabled: sipEnabled,
          },
        },
      });
      await updatePhoneConfigFn({
        data: {
          phoneId: settingsPhoneId,
          payload: {
            verified_name: displayName,
            search_visibility: searchVisibility,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      setPhoneSettingsOpen(false);
      // Refresh phone list
      const activeWaba = searchId || details?.id || list.find((w) => phonesMap[w.id])?.id;
      if (activeWaba) loadPhonesMut.mutate(activeWaba);
    },
    onError: (e: any) => toast.error("Falha ao salvar configurações: " + e.message),
  });

  const obaRequestMut = useMutation({
    mutationFn: () => applyForOBAFn({
      data: {
        phoneId: settingsPhoneId,
        payload: {
          category: obaCategory,
          website: obaWebsite,
          reason: obaReason,
        },
      },
    }),
    onSuccess: () => {
      toast.success("Solicitação de Selo Verde (OBA) enviada com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao solicitar Selo Verde: " + e.message),
  });

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
      if (!busId)
        throw new Error("ID da conta de negócios (Business ID) não configurado nas Configurações.");

      const fn = type === "owned" ? fetchOwned : fetchClient;
      const res = await fn({ data: { businessId: busId } });
      if (!res.ok) throw new Error(res.error || "Erro ao consultar API da Meta.");
      return { data: res.data || [], type };
    },
    onSuccess: (res) => {
      setList(res.data);
      setListType(res.type);
      toast.success(
        `Carregadas ${res.data.length} contas WABA (${res.type === "owned" ? "próprias" : "de clientes"})`,
      );
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
      setLoadingPhones((p) => ({ ...p, [wabaId]: true }));
      const res = await getPhoneNumbers({ data: { wabaId } });
      if (!res.ok) throw new Error(res.error || "Erro ao obter números.");
      return { wabaId, data: res.data || [] };
    },
    onSuccess: (res) => {
      setPhonesMap((p) => ({ ...p, [res.wabaId]: res.data }));
      toast.success(`Carregados ${res.data.length} números de telefone!`);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: (_, __, wabaId) => {
      setLoadingPhones((p) => ({ ...p, [wabaId]: false }));
    },
  });

  const subscribeAppMut = useMutation({
    mutationFn: async (wabaId: string) => {
      setSubscribing((s) => ({ ...s, [wabaId]: true }));
      const res = await subscribeApp({ data: { wabaId } });
      if (!res.ok) throw new Error(res.error || "Erro ao inscrever app.");
      return res;
    },
    onSuccess: () => {
      toast.success("Webhook / App inscrito com sucesso nesta WABA!");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: (_, __, wabaId) => {
      setSubscribing((s) => ({ ...s, [wabaId]: false }));
    },
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
          <div
            key={ph.id}
            className="p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/10"
          >
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground">
                  {ph.verified_name || "Sem Nome de Exibição"}
                </span>
                {ph.is_official_business_account && (
                  <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 border-none h-4 px-1.5 py-0 text-[9px] font-medium leading-none">
                    Oficial
                  </Badge>
                )}
                {ph.status && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-4 px-1.5 py-0 text-[9px] font-medium border-none leading-none",
                      ph.status === "CONNECTED" && "bg-success/15 text-success hover:bg-success/20",
                      ph.status === "FLAGGED" && "bg-amber-500/15 text-amber-500 hover:bg-amber-500/20",
                      ph.status === "RESTRICTED" && "bg-destructive/15 text-destructive hover:bg-destructive/20",
                      !["CONNECTED", "FLAGGED", "RESTRICTED"].includes(ph.status) && "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20"
                    )}
                  >
                    {ph.status}
                  </Badge>
                )}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                +{ph.display_phone_number} (ID: {ph.id})
              </p>
              <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  Qualidade:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      ph.quality_rating === "GREEN" && "text-success",
                      ph.quality_rating === "YELLOW" && "text-amber-500",
                      ph.quality_rating === "RED" && "text-destructive",
                    )}
                  >
                    {ph.quality_rating || "N/A"}
                  </span>
                </span>
                {ph.code_verification_status && (
                  <>
                    <span>·</span>
                    <span>2FA: {ph.code_verification_status}</span>
                  </>
                )}
                {ph.messaging_limit_tier && (
                  <>
                    <span>·</span>
                    <span>Limite: {ph.messaging_limit_tier.replace("TIER_", "")}</span>
                  </>
                )}
                {ph.platform_type && (
                  <>
                    <span>·</span>
                    <span>Plataforma: {ph.platform_type}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() =>
                  defineActivePhoneMut.mutate({
                    phoneId: ph.id,
                    displayPhone: ph.display_phone_number.replace(/\D/g, ""),
                  })
                }
                disabled={defineActivePhoneMut.isPending}
              >
                Usar Número
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => {
                  setOnboardingPhoneId(ph.id);
                  setOnboardingStep(1);
                  setOnboardingOpen(true);
                }}
                disabled={onboardingRegisterPinMut.isPending}
              >
                Assistente Onboarding
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSettingsPhoneId(ph.id);
                  setSettingsTab("general");
                  loadPhoneSettingsMut.mutate(ph.id);
                  setPhoneSettingsOpen(true);
                }}
                title="Configurações avançadas do telefone"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (confirm("⚠️ AVISO CRÍTICO: Desregistrar o número desativará o envio de mensagens. Deseja mesmo desregistrar?")) {
                    deregisterPhoneMut.mutate(ph.id);
                  }
                }}
                title="Desregistrar da Meta"
                disabled={deregisterPhoneMut.isPending}
              >
                {deregisterPhoneMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
            Inscreva webhooks, liste números de telefone, gerencie e registre chaves 2FA das suas
            contas comerciais WABA da Meta.
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
                <p className="text-xs text-muted-foreground">
                  Insira qualquer WABA ID para consultar os detalhes diretamente na Meta.
                </p>
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
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <span className="font-semibold text-sm">
                      {details.name || "Conta sem Nome"}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border-none",
                          (details.account_review_status || details.status) === "APPROVED"
                            ? "bg-success/15 text-success hover:bg-success/20"
                            : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20",
                        )}
                      >
                        Revisão: {details.account_review_status || details.status || "UNKNOWN"}
                      </Badge>
                      {details.business_verification_status && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border-none",
                            details.business_verification_status === "VERIFIED"
                              ? "bg-blue-500/15 text-blue-500 hover:bg-blue-500/20"
                              : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20",
                          )}
                        >
                          Verificação: {details.business_verification_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs space-y-1 font-mono">
                    <p className="text-muted-foreground">
                      <span className="font-sans font-medium text-foreground">ID:</span> {details.id}
                    </p>
                    {details.timezone_id && (
                      <p className="text-muted-foreground">
                        <span className="font-sans font-medium text-foreground">Fuso Horário:</span>{" "}
                        {details.timezone_id}
                      </p>
                    )}
                    {details.message_template_namespace && (
                      <p className="text-muted-foreground">
                        <span className="font-sans font-medium text-foreground">Namespace de Templates:</span>{" "}
                        {details.message_template_namespace}
                      </p>
                    )}
                    {details.country && (
                      <p className="text-muted-foreground">
                        <span className="font-sans font-medium text-foreground">País:</span>{" "}
                        {details.country}
                      </p>
                    )}
                    {details.ownership_type && (
                      <p className="text-muted-foreground">
                        <span className="font-sans font-medium text-foreground">Tipo de Propriedade:</span>{" "}
                        {details.ownership_type}
                      </p>
                    )}
                    {details.primary_business_location && (
                      <p className="text-muted-foreground">
                        <span className="font-sans font-medium text-foreground">Localização:</span>{" "}
                        {details.primary_business_location}
                      </p>
                    )}
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
                        onClick={() => openEditWabaDialog(details)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar WABA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => subscribeAppMut.mutate(details.id)}
                        disabled={subscribing[details.id]}
                      >
                        {subscribing[details.id] && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        Inscrever Webhook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadPhonesMut.mutate(details.id)}
                        disabled={loadingPhones[details.id]}
                      >
                        {loadingPhones[details.id] && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
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
                <h3 className="font-medium text-sm text-foreground">
                  Listar WABAs por Business ID
                </h3>
                <p className="text-xs text-muted-foreground">
                  Listar todas as contas WABAs associadas ao seu Meta Business ID.
                </p>
              </div>

              {profileData?.whatsapp_business_id ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={listType === "owned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => listMut.mutate("owned")}
                      disabled={listMut.isPending || listAssignedMut.isPending}
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
                      disabled={listMut.isPending || listAssignedMut.isPending}
                    >
                      {listMut.isPending && listType === "client" ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Clientes (Client)
                    </Button>
                    <Button
                      variant={listType === "assigned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => listAssignedMut.mutate()}
                      disabled={listMut.isPending || listAssignedMut.isPending}
                    >
                      {listAssignedMut.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Atribuídas ao Token
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
                              <p className="font-mono text-[10px] text-muted-foreground">
                                ID: {w.id}
                              </p>
                              <p className="text-muted-foreground text-[10px] mt-0.5">
                                Fuso: {w.timezone_id || "N/A"}{w.country && ` · País: ${w.country}`}{w.business_verification_status && ` · Verif.: ${w.business_verification_status}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "border-none",
                                  (w.account_review_status || w.status) === "APPROVED"
                                    ? "bg-success/15 text-success hover:bg-success/20"
                                    : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/20",
                                )}
                              >
                                {w.account_review_status || w.status || "UNKNOWN"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => defineActiveMut.mutate(w.id)}
                                disabled={defineActiveMut.isPending}
                              >
                                Ativar
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditWabaDialog(w)}
                                title="Editar WABA"
                              >
                                <Pencil className="h-3.5 w-3.5" />
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
                              {subscribing[w.id] && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              Inscrever Webhook
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2 ml-auto"
                              onClick={() => loadPhonesMut.mutate(w.id)}
                              disabled={loadingPhones[w.id]}
                            >
                              {loadingPhones[w.id] && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
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
                    Você precisa salvar o{" "}
                    <strong>ID da conta de negócios (Meta Business ID)</strong> no passo 1 do
                    assistente acima para poder listar suas contas WABA.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Wizard Dialog */}
      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Assistente de Ativação do Número</DialogTitle>
            <DialogDescription>
              Complete as etapas para verificar e ativar seu número na Meta Cloud API.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between border-y py-3 my-2 text-xs">
            <span className={cn("px-2 py-1 rounded-full font-medium", onboardingStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              1. Solicitar Código
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn("px-2 py-1 rounded-full font-medium", onboardingStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              2. Verificar Código
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn("px-2 py-1 rounded-full font-medium", onboardingStep === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              3. Registrar PIN
            </span>
          </div>

          {onboardingStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Método de Envio</Label>
                <Select value={codeMethod} onValueChange={(val: any) => setCodeMethod(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMS">SMS (Recomendado)</SelectItem>
                    <SelectItem value="VOICE">Chamada de Voz</SelectItem>
                    <SelectItem value="IVR">IVR (Chamada Interativa de Voz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Idioma do Código</Label>
                <Select value={codeLanguage} onValueChange={setCodeLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US">Inglês (Estados Unidos)</SelectItem>
                    <SelectItem value="es_ES">Espanhol (Espanha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setOnboardingOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => onboardingRequestCodeMut.mutate()} 
                  disabled={onboardingRequestCodeMut.isPending}
                >
                  {onboardingRequestCodeMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Solicitar Código
                </Button>
              </DialogFooter>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Código de Verificação</Label>
                <Input
                  placeholder="Ex: 123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-lg tracking-widest"
                  maxLength={6}
                />
                <p className="text-[11px] text-muted-foreground">
                  Insira o código numérico enviado pela Meta via {codeMethod === "SMS" ? "SMS" : "Chamada de Voz"}.
                </p>
              </div>

              <DialogFooter className="pt-4 border-t flex justify-between">
                <Button variant="outline" onClick={() => setOnboardingStep(1)}>
                  Voltar
                </Button>
                <Button 
                  onClick={() => onboardingVerifyCodeMut.mutate()} 
                  disabled={onboardingVerifyCodeMut.isPending || verificationCode.length < 4}
                >
                  {onboardingVerifyCodeMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Verificar Código
                </Button>
              </DialogFooter>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Definir PIN de Duas Etapas (6 dígitos)</Label>
                <Input
                  type="password"
                  placeholder="Ex: 123456"
                  value={twoFactorPin}
                  onChange={(e) => setTwoFactorPin(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-lg tracking-widest"
                  maxLength={6}
                />
                <p className="text-[11px] text-muted-foreground">
                  Este PIN será registrado como segurança de duas etapas (2FA) para o seu número na Cloud API. Use apenas números.
                </p>
              </div>

              <DialogFooter className="pt-4 border-t flex justify-between">
                <Button variant="outline" onClick={() => setOnboardingStep(2)}>
                  Voltar
                </Button>
                <Button 
                  onClick={() => onboardingRegisterPinMut.mutate()} 
                  disabled={onboardingRegisterPinMut.isPending || twoFactorPin.length !== 6}
                >
                  {onboardingRegisterPinMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Registrar PIN e Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Phone Settings Dialog */}
      <Dialog open={phoneSettingsOpen} onOpenChange={setPhoneSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurações do Telefone</DialogTitle>
            <DialogDescription>
              Gerencie configurações avançadas, nome de exibição e solicitação de Selo Oficial.
            </DialogDescription>
          </DialogHeader>

          {loadPhoneSettingsMut.isPending ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando configurações da Meta...</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex border-b text-sm">
                <button
                  type="button"
                  className={cn("px-4 py-2 border-b-2 font-medium transition-colors", settingsTab === "general" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => setSettingsTab("general")}
                >
                  Geral e Nome
                </button>
                <button
                  type="button"
                  className={cn("px-4 py-2 border-b-2 font-medium transition-colors", settingsTab === "calling" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => setSettingsTab("calling")}
                >
                  Chamadas
                </button>
                <button
                  type="button"
                  className={cn("px-4 py-2 border-b-2 font-medium transition-colors", settingsTab === "oba" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => setSettingsTab("oba")}
                >
                  Selo Verde (OBA)
                </button>
              </div>

              {settingsTab === "general" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nome de Exibição (Verified Name)</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nome oficial da empresa"
                    />
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      ⚠️ Mudar o nome de exibição exige aprovação da Meta. O número pode ficar temporariamente em revisão.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Visibilidade de Pesquisa</Label>
                    <Select value={searchVisibility} onValueChange={setSearchVisibility}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">Público (Visível na busca do WhatsApp)</SelectItem>
                        <SelectItem value="PRIVATE">Privado (Invisível na busca)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {settingsTab === "calling" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <Label className="font-semibold">Habilitar Chamadas de Voz</Label>
                      <p className="text-xs text-muted-foreground">Permite receber chamadas de voz de usuários do WhatsApp.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={callingEnabled}
                      onChange={(e) => setCallingEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between pb-3">
                    <div>
                      <Label className="font-semibold">Protocolo SIP (PABX)</Label>
                      <p className="text-xs text-muted-foreground">Roteia chamadas via SIP para integração com centrais VoIP.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sipEnabled}
                      onChange={(e) => setSipEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {settingsTab === "oba" && (
                <div className="space-y-4">
                  <div className="bg-muted/30 p-3 rounded-lg border text-xs space-y-1.5">
                    <p className="font-semibold text-foreground">Status Atual do Selo Oficial:</p>
                    <div>
                      Selo OBA:{" "}
                      <Badge variant="outline" className={cn(obaStatus?.oba_status === "APPROVED" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground")}>
                        {obaStatus?.oba_status || "Não oficial / Não solicitado"}
                      </Badge>
                    </div>
                    {obaStatus?.status_message && (
                      <p className="text-muted-foreground italic">"{obaStatus.status_message}"</p>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <h4 className="text-xs font-semibold text-foreground">Solicitar Selo Verde (OBA)</h4>
                    <div className="space-y-1.5">
                      <Label>Categoria da Empresa</Label>
                      <Select value={obaCategory} onValueChange={setObaCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OTHER">Outros</SelectItem>
                          <SelectItem value="FINANCE">Finanças / Bancos</SelectItem>
                          <SelectItem value="RETAIL">Varejo / E-commerce</SelectItem>
                          <SelectItem value="HEALTH">Saúde</SelectItem>
                          <SelectItem value="EDUCATION">Educação</SelectItem>
                          <SelectItem value="GOVERNMENT">Governo / Institucional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Website de Referência</Label>
                      <Input
                        value={obaWebsite}
                        onChange={(e) => setObaWebsite(e.target.value)}
                        placeholder="https://suaempresa.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Motivo da Solicitação</Label>
                      <Textarea
                        value={obaReason}
                        onChange={(e) => setObaReason(e.target.value)}
                        placeholder="Descreva por que sua marca é de interesse público..."
                        rows={3}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => obaRequestMut.mutate()}
                      disabled={obaRequestMut.isPending}
                    >
                      {obaRequestMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      Enviar Solicitação de Selo Verde
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setPhoneSettingsOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => savePhoneSettingsMut.mutate()}
                  disabled={savePhoneSettingsMut.isPending}
                >
                  {savePhoneSettingsMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WABA Edit Dialog */}
      <Dialog open={wabaEditDialogOpen} onOpenChange={setWabaEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Editar Conta WhatsApp Business (WABA)</DialogTitle>
            <DialogDescription>
              Atualize as configurações e informações da conta comercial selecionada diretamente na Meta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateWaba} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="waba-id-field">WABA ID</Label>
              <Input
                id="waba-id-field"
                value={editWabaId}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waba-name-field">Nome da WABA</Label>
              <Input
                id="waba-name-field"
                value={editWabaName}
                onChange={(e) => setEditWabaName(e.target.value)}
                placeholder="Ex: Minha Empresa WhatsApp"
                required
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                Nome de exibição da conta comercial do WhatsApp Business na Meta.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waba-timezone-field">Fuso Horário (Timezone ID)</Label>
              <Input
                id="waba-timezone-field"
                value={editWabaTimezone}
                onChange={(e) => setEditWabaTimezone(e.target.value)}
                placeholder="Ex: America/Sao_Paulo"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                Identificador de fuso horário da Meta. Ex: America/Sao_Paulo, America/New_York, UTC.
              </p>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setWabaEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateWabaMut.isPending}>
                {updateWabaMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AdvancedToolsSection() {
  const [collapsed, toggleCollapsed] = usePersistedCollapsedState(
    "zapdispatch_settings_advanced_tools_collapsed",
    true,
  );
  
  const [activeTab, setActiveTab] = useState("bots");
  
  const profileQuery = useQuery({ queryKey: ["profile"] });
  const profileData = profileQuery.data as any;
  const activePhoneId = profileData?.whatsapp_phone_number_id || "";

  // 1. Bots Tab States
  const [botId, setBotId] = useState("");
  const [botDetails, setBotDetails] = useState<any>(null);
  const fetchBotDetails = useServerFn(getWABABotDetails);
  const botMut = useMutation({
    mutationFn: () => fetchBotDetails({ data: { botId } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setBotDetails(res.data || res);
        toast.success("Detalhes do robô WABA carregados!");
      } else {
        toast.error(res.error || "Erro ao carregar robô.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 2. Calls Tab States
  const [callRecipient, setCallRecipient] = useState("");
  const [callId, setCallId] = useState("");
  const [sdpValue, setSdpValue] = useState("");
  const [sdpType, setSdpType] = useState("offer");
  const [callPermResult, setCallPermResult] = useState<any>(null);
  
  const checkCallPermFn = useServerFn(checkCallPermissions);
  const manageCallFn = useServerFn(manageCall);

  const checkCallPermMut = useMutation({
    mutationFn: () => checkCallPermFn({ data: { phoneId: activePhoneId, recipientPhone: callRecipient } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setCallPermResult(res.data);
        toast.success("Permissões de chamada verificadas!");
      } else {
        toast.error(res.error || "Erro ao verificar permissão.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const manageCallMut = useMutation({
    mutationFn: (action: "connect" | "accept" | "reject" | "terminate") =>
      manageCallFn({
        data: {
          phoneId: activePhoneId,
          action,
          to: action === "connect" ? callRecipient : undefined,
          callId: action !== "connect" ? callId : undefined,
          sdp: sdpValue || undefined,
          sdpType: sdpValue ? sdpType : undefined,
        },
      }),
    onSuccess: (res: any, action) => {
      if (res.ok) {
        toast.success(`Chamada: Ação "${action}" executada com sucesso!`);
        if (res.data?.call_id) {
          setCallId(res.data.call_id);
        }
      } else {
        toast.error(res.error || `Erro ao executar ação "${action}".`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 3. Sandbox Messages States
  const [msgRecipient, setMsgRecipient] = useState("");
  const [msgType, setMsgType] = useState<"text" | "marketing" | "interactive">("text");
  
  // msg text fields
  const [msgTextBody, setMsgTextBody] = useState("");
  // msg marketing fields
  const [templateName, setTemplateName] = useState("hello_world");
  const [templateLanguage, setTemplateLanguage] = useState("en_us");
  const [templateParamsJson, setTemplateParamsJson] = useState("[]");
  // msg interactive fields
  const [interactiveJson, setInteractiveJson] = useState(
    JSON.stringify(
      {
        type: "button",
        header: { type: "text", text: "Título da Mensagem" },
        body: { text: "Corpo da mensagem interativa" },
        footer: { text: "Rodapé" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "btn_1", title: "Opção 1" } },
            { type: "reply", reply: { id: "btn_2", title: "Opção 2" } },
          ],
        },
      },
      null,
      2,
    ),
  );

  const sendSandboxFn = useServerFn(sendAdvancedSandboxMessage);
  const sendSandboxMut = useMutation({
    mutationFn: () => {
      let payload: any = {};
      if (msgType === "text") {
        payload = { text: { body: msgTextBody } };
      } else if (msgType === "marketing") {
        let params = [];
        try {
          params = JSON.parse(templateParamsJson);
        } catch {
          throw new Error("Parâmetros do template precisam ser um JSON válido (Array).");
        }
        payload = {
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: params,
          },
        };
      } else {
        let interactiveData = {};
        try {
          interactiveData = JSON.parse(interactiveJson);
        } catch {
          throw new Error("Estrutura interativa precisa ser um JSON válido.");
        }
        payload = {
          type: "interactive",
          interactive: interactiveData,
        };
      }
      return sendSandboxFn({
        data: {
          phoneId: activePhoneId,
          type: msgType,
          to: msgRecipient,
          payload,
        },
      });
    },
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success("Mensagem de sandbox enviada com sucesso!");
      } else {
        toast.error(res.error || "Erro ao enviar mensagem.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 4. Media Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState("");
  const uploadMediaFn = useServerFn(uploadMetaMedia);
  const uploadMediaMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Selecione um arquivo primeiro.");
      
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = (e) => reject(e);
      });

      return uploadMediaFn({
        data: {
          phoneId: activePhoneId,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileBase64,
        },
      });
    },
    onSuccess: (res: any) => {
      if (res.ok) {
        setUploadedMediaId(res.data?.id);
        toast.success("Mídia carregada com sucesso na Meta!");
      } else {
        toast.error(res.error || "Erro ao carregar mídia.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 5. Solution Partner States
  const [solId, setSolId] = useState("");
  const [solDetails, setSolDetails] = useState<any>(null);
  const [solBusinessId, setSolBusinessId] = useState("");
  const [solAccessToken, setSolAccessToken] = useState("");

  const getSolDetailsFn = useServerFn(getSolutionDetails);
  const acceptSolInvFn = useServerFn(acceptSolutionInvitation);
  const rejectSolInvFn = useServerFn(rejectSolutionInvitation);
  const sendSolDeactFn = useServerFn(sendSolutionDeactivation);
  const acceptSolDeactFn = useServerFn(acceptSolutionDeactivation);
  const rejectSolDeactFn = useServerFn(rejectSolutionDeactivation);
  const getSolTokenFn = useServerFn(getSolutionAccessToken);

  const getSolDetailsMut = useMutation({
    mutationFn: () => getSolDetailsFn({ data: { solutionId: solId } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setSolDetails(res.data || res);
        toast.success("Detalhes da Solução carregados!");
      } else {
        toast.error(res.error || "Erro ao carregar detalhes da solução.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const solLifecycleMut = useMutation({
    mutationFn: async (action: "accept" | "reject" | "deactivate" | "accept_deact" | "reject_deact") => {
      const fns = {
        accept: acceptSolInvFn,
        reject: rejectSolInvFn,
        deactivate: sendSolDeactFn,
        accept_deact: acceptSolDeactFn,
        reject_deact: rejectSolDeactFn,
      };
      const res = await fns[action]({ data: { solutionId: solId } });
      if (!res.ok) throw new Error(res.error || "Erro ao executar ação da solução.");
      return res.data || res;
    },
    onSuccess: (data) => {
      setSolDetails(data);
      toast.success("Ação na solução executada com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSolTokenMut = useMutation({
    mutationFn: () => getSolTokenFn({ data: { solutionId: solId, businessId: solBusinessId } }),
    onSuccess: (res: any) => {
      if (res.ok) {
        setSolAccessToken(res.data?.access_token || res.data?.token || JSON.stringify(res.data));
        toast.success("Token granular da solução obtido com sucesso!");
      } else {
        toast.error(res.error || "Erro ao obter token.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6 border-primary/20 bg-background/50 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Ferramentas Avançadas de Comunicação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse ferramentas avançadas para Robôs, Chamadas (SDP), Mensagens Sandbox, Upload de Mídia e Gestão de Soluções Multi-Parceiro.
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
        <div className="mt-6 border-t pt-6 space-y-6">
          {!activePhoneId && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 p-3 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Atenção: Nenhum número de telefone ativo selecionado. Algumas ferramentas de chamadas e mensagens sandbox exigem um telefone ativo. Clique em "Usar Número" na lista acima.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1 border-b pb-2 text-xs">
            <button
              type="button"
              className={cn("px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5", activeTab === "bots" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              onClick={() => setActiveTab("bots")}
            >
              <Bot className="h-3.5 w-3.5" />
              Robô WABA
            </button>
            <button
              type="button"
              className={cn("px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5", activeTab === "calls" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              onClick={() => setActiveTab("calls")}
            >
              <Phone className="h-3.5 w-3.5" />
              Chamadas
            </button>
            <button
              type="button"
              className={cn("px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5", activeTab === "messages" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              onClick={() => setActiveTab("messages")}
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Mensagem
            </button>
            <button
              type="button"
              className={cn("px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5", activeTab === "media" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              onClick={() => setActiveTab("media")}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload de Mídia
            </button>
            <button
              type="button"
              className={cn("px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5", activeTab === "solutions" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
              onClick={() => setActiveTab("solutions")}
            >
              <Users className="h-3.5 w-3.5" />
              Parcerias (Solutions)
            </button>
          </div>

          {activeTab === "bots" && (
            <div className="space-y-4 max-w-xl text-xs">
              <div className="space-y-1.5">
                <Label>ID do Robô WABA</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Bot ID..."
                    value={botId}
                    onChange={(e) => setBotId(e.target.value)}
                  />
                  <Button
                    onClick={() => botMut.mutate()}
                    disabled={botMut.isPending || !botId.trim()}
                  >
                    {botMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar Robô"}
                  </Button>
                </div>
              </div>

              {botDetails && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-semibold text-sm">Robô: {botDetails.id}</span>
                    <Badge variant="outline" className={cn(botDetails.enable_welcome_message ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground")}>
                      Welcome Message: {botDetails.enable_welcome_message ? "Sim" : "Não"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-foreground mb-1">Prompts / Diretrizes:</p>
                      <pre className="p-2 border rounded bg-background font-mono text-[10px] max-h-32 overflow-y-auto">
                        {JSON.stringify(botDetails.prompts || [], null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">Comandos Configurados:</p>
                      <pre className="p-2 border rounded bg-background font-mono text-[10px] max-h-32 overflow-y-auto">
                        {JSON.stringify(botDetails.commands || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "calls" && (
            <div className="grid gap-6 md:grid-cols-2 text-xs">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Permissões e Iniciar</h3>
                  <p className="text-xs text-muted-foreground">Verifique se o destinatário aceita chamadas e inicie com SDP.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Destinatário (DDD + número)</Label>
                  <Input
                    placeholder="Ex: 5511999999999"
                    value={callRecipient}
                    onChange={(e) => setCallRecipient(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => checkCallPermMut.mutate()}
                    disabled={checkCallPermMut.isPending || !callRecipient || !activePhoneId}
                  >
                    {checkCallPermMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Verificar Permissões
                  </Button>
                  
                  <Button
                    onClick={() => manageCallMut.mutate("connect")}
                    disabled={manageCallMut.isPending || !callRecipient || !activePhoneId}
                  >
                    {manageCallMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Iniciar Chamada (Connect)
                  </Button>
                </div>

                {callPermResult && (
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="font-semibold text-foreground mb-1">Resultado de Permissão:</p>
                    <pre className="font-mono text-[10px]">{JSON.stringify(callPermResult, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Gerenciamento de Chamadas Ativas</h3>
                  <p className="text-xs text-muted-foreground">Insira chaves SDP e Call ID para aceitar, rejeitar ou encerrar.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Call ID (ID da Chamada)</Label>
                  <Input
                    placeholder="Call ID..."
                    value={callId}
                    onChange={(e) => setCallId(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>SDP Payload</Label>
                    <Textarea
                      placeholder="Session Description Protocol..."
                      value={sdpValue}
                      onChange={(e) => setSdpValue(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>SDP Type</Label>
                    <Select value={sdpType} onValueChange={setSdpType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offer">Offer (Proposta)</SelectItem>
                        <SelectItem value="answer">Answer (Resposta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => manageCallMut.mutate("accept")}
                    disabled={manageCallMut.isPending || !callId || !activePhoneId}
                  >
                    Aceitar (Accept)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => manageCallMut.mutate("reject")}
                    disabled={manageCallMut.isPending || !callId || !activePhoneId}
                  >
                    Rejeitar (Reject)
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => manageCallMut.mutate("terminate")}
                    disabled={manageCallMut.isPending || !callId || !activePhoneId}
                  >
                    Encerrar (Terminate)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <div className="grid gap-6 md:grid-cols-2 text-xs">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Destinatário & Tipo</h3>
                  <p className="text-xs text-muted-foreground">Defina o número e o tipo de mensagem sandbox da API.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Destinatário (E.164 sem +)</Label>
                  <Input
                    placeholder="Ex: 5511999999999"
                    value={msgRecipient}
                    onChange={(e) => setMsgRecipient(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Tipo de Mensagem</Label>
                  <Select value={msgType} onValueChange={(val: any) => setMsgType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto Livre</SelectItem>
                      <SelectItem value="marketing">Template de Marketing</SelectItem>
                      <SelectItem value="interactive">Mensagem Interativa (JSON)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={() => sendSandboxMut.mutate()}
                  disabled={sendSandboxMut.isPending || !msgRecipient || !activePhoneId}
                >
                  {sendSandboxMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Enviar Mensagem Sandbox
                </Button>
              </div>

              <div className="space-y-4 border-l pl-6">
                {msgType === "text" && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-foreground">Mensagem de Texto</h4>
                      <p className="text-xs text-muted-foreground">Texto livre que requer janela de 24h aberta.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Corpo da Mensagem</Label>
                      <Textarea
                        placeholder="Escreva sua mensagem..."
                        value={msgTextBody}
                        onChange={(e) => setMsgTextBody(e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {msgType === "marketing" && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-foreground">Template de Marketing</h4>
                      <p className="text-xs text-muted-foreground">Envia campanhas via templates de marketing.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>Nome do Template</Label>
                        <Input
                          placeholder="Ex: hello_world"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Idioma</Label>
                        <Input
                          placeholder="Ex: pt_BR"
                          value={templateLanguage}
                          onChange={(e) => setTemplateLanguage(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Componentes (JSON Array)</Label>
                      <Textarea
                        value={templateParamsJson}
                        onChange={(e) => setTemplateParamsJson(e.target.value)}
                        rows={3}
                        className="font-mono text-[10px]"
                      />
                    </div>
                  </div>
                )}

                {msgType === "interactive" && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-foreground">Interactive (Botões, Listas)</h4>
                      <p className="text-xs text-muted-foreground">Monte estruturas interativas.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estrutura da Mensagem Interativa (JSON)</Label>
                      <Textarea
                        value={interactiveJson}
                        onChange={(e) => setInteractiveJson(e.target.value)}
                        rows={6}
                        className="font-mono text-[10px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-4 max-w-xl text-xs">
              <div>
                <h3 className="font-medium text-sm text-foreground">Carregar Mídia na API da Meta</h3>
                <p className="text-xs text-muted-foreground">Faça upload de arquivos e use o ID retornado.</p>
              </div>

              <div className="border border-dashed rounded-lg p-6 bg-muted/10 text-center space-y-3">
                <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <div className="flex flex-col items-center justify-center">
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="text-xs cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {selectedFile && (
                    <p className="mt-2 text-foreground font-medium">
                      Selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => uploadMediaMut.mutate()}
                disabled={uploadMediaMut.isPending || !selectedFile || !activePhoneId}
              >
                {uploadMediaMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Fazer Upload para Meta
              </Button>

              {uploadedMediaId && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">Media ID Gerado:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        navigator.clipboard.writeText(uploadedMediaId);
                        toast.success("Media ID copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar ID
                    </Button>
                  </div>
                  <p className="font-mono bg-background p-2 rounded text-xs select-all text-foreground border">{uploadedMediaId}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "solutions" && (
            <div className="grid gap-6 md:grid-cols-2 text-xs">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Parcerias e Soluções Multi-Parceiro</h3>
                  <p className="text-xs text-muted-foreground">Gerencie o ciclo de vida da solução da Meta (aceitar convites, rejeitar parcerias ou solicitar desativações).</p>
                </div>

                <div className="space-y-1.5">
                  <Label>ID da Solução (Solution ID)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Solution ID..."
                      value={solId}
                      onChange={(e) => setSolId(e.target.value)}
                    />
                    <Button
                      onClick={() => getSolDetailsMut.mutate()}
                      disabled={getSolDetailsMut.isPending || !solId.trim()}
                    >
                      {getSolDetailsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                </div>

                {solDetails && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-semibold text-sm">Solução: {solDetails.id}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {solDetails.status || "N/A"}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <p><span className="font-medium text-foreground">Nome:</span> {solDetails.name || "N/A"}</p>
                      <p><span className="font-medium text-foreground">Status do Pedido:</span> {solDetails.status_for_pending_request || "N/A"}</p>
                      <p><span className="font-medium text-foreground">App Dono:</span> {solDetails.owner_app || "N/A"}</p>
                      <div>
                        <span className="font-medium text-foreground">Permissões Dono:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(solDetails.owner_permissions || []).map((p: string) => (
                            <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <p className="font-medium text-foreground">Ações de Onboarding & Ciclo de Vida:</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => solLifecycleMut.mutate("accept")}
                          disabled={solLifecycleMut.isPending}
                        >
                          Aceitar Convite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => solLifecycleMut.mutate("reject")}
                          disabled={solLifecycleMut.isPending}
                        >
                          Rejeitar Convite
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 border-t border-dashed pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => solLifecycleMut.mutate("deactivate")}
                          disabled={solLifecycleMut.isPending}
                        >
                          Pedir Desativação
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => solLifecycleMut.mutate("accept_deact")}
                          disabled={solLifecycleMut.isPending}
                        >
                          Aceitar Desat.
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => solLifecycleMut.mutate("accept_deact")}
                          disabled={solLifecycleMut.isPending}
                        >
                          Rejeitar Desat.
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-l pl-6">
                <div>
                  <h3 className="font-medium text-sm text-foreground">Token de Acesso da Solução</h3>
                  <p className="text-xs text-muted-foreground">Gere tokens granulares para acessar contas comerciais do cliente através da parceria.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>ID do Cliente (Customer Business ID)</Label>
                  <Input
                    placeholder="Business ID do Cliente..."
                    value={solBusinessId}
                    onChange={(e) => setSolBusinessId(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => getSolTokenMut.mutate()}
                  disabled={getSolTokenMut.isPending || !solId.trim() || !solBusinessId.trim()}
                >
                  {getSolTokenMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Gerar Access Token Granular
                </Button>

                {solAccessToken && (
                  <div className="bg-muted/30 p-3 rounded-lg border space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground text-xs">Token do Parceiro:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          navigator.clipboard.writeText(solAccessToken);
                          toast.success("Token copiado!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copiar Token
                      </Button>
                    </div>
                    <pre className="p-2 border rounded bg-background font-mono text-[10px] max-h-32 overflow-y-auto whitespace-pre-wrap select-all text-foreground">
                      {solAccessToken}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
