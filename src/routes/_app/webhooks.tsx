import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  listIncomingWebhooks,
  createIncomingWebhook,
  updateIncomingWebhook,
  duplicateIncomingWebhook,
  updateIncomingWebhookStatus,
  deleteIncomingWebhook,
  regenerateIncomingWebhookToken,
  listIncomingWebhookEvents,
  updateIncomingWebhookFieldLabels,
  listOutgoingWebhooks,
  createOutgoingWebhook,
  updateOutgoingWebhook,
  duplicateOutgoingWebhook,
  updateOutgoingWebhookStatus,
  deleteOutgoingWebhook,
  listOutgoingWebhookLogs,
  listWebhookLeads,
} from "@/lib/webhooks.functions";
import { listStandardFields, saveWebhookFieldMappings, listCustomFields } from "@/lib/custom-fields.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Webhook,
  Plus,
  Copy,
  RefreshCw,
  AlertTriangle,
  Check,
  Activity,
  Trash2,
  Lock,
  ChevronRight,
  Save,
  Search,
  ArrowRight,
  Settings,
  X,
  Sparkles,
  Calendar,
  Send,
  MoreVertical,
  Pencil,
  Files,
  Database,
  Link2,
  Users,
  Eye,
  Globe,
  Clock,
  Filter,
  FileJson,
  TrendingUp,
  AlertCircle,
  UserCheck,
  XCircle,
  ChevronLeft,
  CheckCircle2,
  Phone,
  Mail,
  Pin,
  Tag,
  FileCode,
  Code,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


// ──────────────────────────────────────────────────────────────────────────────
// Component: EmbedSnippetBox
// ──────────────────────────────────────────────────────────────────────────────
function EmbedSnippetBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const webhookUrl = `${origin}/api/public/webhooks/incoming/${token}`;
  const snippet = `<script>
(function(){
  var WAPI_URL="${webhookUrl}";
  function getData(form){
    var d={},els=form.elements;
    for(var i=0;i<els.length;i++){
      var e=els[i];if(!e.name)continue;
      if(e.type==="checkbox")d[e.name]=e.checked;
      else if(e.type==="radio"){if(e.checked)d[e.name]=e.value;}
      else if(e.tagName==="SELECT")d[e.name]=e.options[e.selectedIndex]?.text||e.value;
      else d[e.name]=e.value;
    }
    return d;
  }
  document.addEventListener("submit",function(ev){
    var form=ev.target;
    fetch(WAPI_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getData(form)),keepalive:true}).catch(function(){});
  },true);
})();
<\/script>`;

  return (
    <div className="bg-background border border-border rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-display text-foreground flex items-center gap-1.5">
          <Code className="h-3.5 w-3.5 text-primary" /> Snippet para Formulários do Site
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(snippet).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            });
          }}
          className="h-7 text-[11px] text-primary hover:bg-primary/10"
        >
          {copied ? (
            <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> Copiado!</>
          ) : (
            <><Copy className="h-3 w-3 mr-1" /> Copiar Snippet</>
          )}
        </Button>
      </div>

      <div className="bg-card p-2.5 rounded-lg border border-border font-mono text-[10px] text-muted-foreground overflow-x-auto whitespace-pre leading-relaxed max-h-32 overflow-y-auto select-all">
        {snippet}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Cole no <code className="bg-muted px-1 rounded text-[10px]">&lt;head&gt;</code> do seu site (Webflow, Wix, WordPress, HTML).
        Captura automaticamente todos os campos do formulário e envia ao CRM — sem depender da integração nativa da plataforma.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Component: WebhookLeadsPanel
// ──────────────────────────────────────────────────────────────────────────────
function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function shortUA(ua: string | null) {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("curl")) return "cURL";
  if (ua.includes("axios")) return "axios";
  if (ua.includes("node")) return "Node.js";
  if (ua.includes("python")) return "Python";
  return ua.slice(0, 22) + "…";
}

interface WebhookLeadsPanelProps {
  webhook: any | null;
  statusFilter: "all" | "success" | "error";
  page: number;
  expandedId: string | null;
  leadsQ: any;
  onClose: () => void;
  onStatusChange: (f: "all" | "success" | "error") => void;
  onPageChange: (p: number | ((prev: number) => number)) => void;
  onExpandToggle: (id: string | null) => void;
}

function WebhookLeadsPanel({
  webhook,
  statusFilter,
  page,
  expandedId,
  leadsQ,
  onClose,
  onStatusChange,
  onPageChange,
  onExpandToggle,
}: WebhookLeadsPanelProps) {
  const data = leadsQ.data as any;
  const events: any[] = data?.events ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const errorCount = events.filter((e) => e.status !== "success").length;

  return (
    <div className="space-y-6">
      {/* Top Bar / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-5 gap-4">
        {/* Título & Ícone à esquerda */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display text-foreground truncate">
              Leads & Eventos — {webhook?.name}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Histórico completo de entradas recebidas por este webhook
            </p>
          </div>
        </div>

        {/* Botões de Ação à direita */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => leadsQ.refetch()}
            className="h-9 text-xs rounded-xl border-border px-3.5 font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${leadsQ.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-3.5 text-xs font-bold rounded-xl border-border hover:bg-muted shrink-0"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border p-4 text-center rounded-2xl shadow-xs">
          <div className="text-2xl font-bold font-display text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">Eventos (filtro)</div>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/20 p-4 text-center rounded-2xl shadow-xs">
          <div className="text-2xl font-bold font-display text-emerald-500">{webhook?.leads_count ?? 0}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Leads Criados</div>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20 p-4 text-center rounded-2xl shadow-xs">
          <div className="text-2xl font-bold font-display text-destructive">{errorCount}</div>
          <div className="text-xs text-destructive/80 font-medium mt-0.5">Erros (página)</div>
        </Card>
        <Card className="bg-card border-border p-4 text-center rounded-2xl shadow-xs">
          <div className="text-2xl font-bold font-display text-foreground">{webhook?.events_count ?? 0}</div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">Total Geral</div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {(["all", "success", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onStatusChange(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              statusFilter === f
                ? "bg-primary text-white border-primary shadow-xs"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {f === "all" && "Todos"}
            {f === "success" && (
              <>
                <CheckCircle2 className={`h-3.5 w-3.5 ${statusFilter === f ? "text-white" : "text-emerald-500"}`} />
                <span>Sucesso</span>
              </>
            )}
            {f === "error" && (
              <>
                <XCircle className={`h-3.5 w-3.5 ${statusFilter === f ? "text-white" : "text-destructive"}`} />
                <span>Erros</span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content / Event List */}
      <div className="space-y-3 min-h-[300px]">
        {leadsQ.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card border border-border rounded-2xl">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Carregando eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-border rounded-2xl bg-card/40">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Nenhum evento encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter !== "all" ? "Tente mudar o filtro de status" : "Este webhook ainda não recebeu dados"}
              </p>
            </div>
          </div>
        ) : (
          events.map((ev) => {
            const isExpanded = expandedId === ev.id;
            const isSuccess = ev.status === "success";
            const payloadKeys = Object.keys(ev.payload ?? {}).filter(
              (k) => !["headers", "executionMode", "webhookUrl", "query", "params"].includes(k)
            );
            return (
              <div
                key={ev.id}
                className={`border rounded-2xl overflow-hidden transition-all bg-card ${
                  isSuccess
                    ? "border-border hover:border-primary/40"
                    : "border-destructive/30 bg-destructive/5 hover:border-destructive/60"
                }`}
              >
                {/* Row Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => onExpandToggle(isExpanded ? null : ev.id)}
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSuccess ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                  }`}>
                    {isSuccess ? <UserCheck className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">
                        {ev.display_name && ev.display_name !== "—" ? ev.display_name : "Lead sem nome"}
                      </span>
                      {ev.contact_id && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-semibold shrink-0">
                          Contato vinculado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {ev.display_phone && ev.display_phone !== "—" && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground/70" /> {ev.display_phone}
                        </span>
                      )}
                      {ev.display_email && ev.display_email !== "—" && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/70" /> {ev.display_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {ev.ip_address && (
                      <span className="hidden lg:flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" /> {ev.ip_address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {fmt(ev.created_at)}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {/* Error Banner */}
                {!isSuccess && ev.error_message && (
                  <div className="mx-4 mb-3 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="break-all">{ev.error_message}</span>
                  </div>
                )}

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border bg-background/60 p-5 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IP de Origem</p>
                        <p className="text-xs font-mono text-foreground bg-card border border-border rounded-xl px-3 py-2">{ev.ip_address ?? "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Navegador / Cliente</p>
                        <p className="text-xs font-mono text-foreground bg-card border border-border rounded-xl px-3 py-2 truncate" title={ev.user_agent ?? ""}>{shortUA(ev.user_agent)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data / Hora</p>
                        <p className="text-xs font-mono text-foreground bg-card border border-border rounded-xl px-3 py-2">{fmt(ev.created_at)}</p>
                      </div>
                      {ev.processing_ms !== null && ev.processing_ms !== undefined && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Processamento</p>
                          <p className="text-xs font-mono text-foreground bg-card border border-border rounded-xl px-3 py-2">{ev.processing_ms}ms</p>
                        </div>
                      )}
                    </div>

                    {payloadKeys.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FileJson className="h-3.5 w-3.5" /> Dados Recebidos (Payload)
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {payloadKeys.map((k) => (
                            <div key={k} className="bg-card border border-border rounded-xl px-3 py-2">
                              <p className="text-[10px] text-muted-foreground font-medium">{k}</p>
                              <p className="text-xs text-foreground font-mono truncate" title={String(ev.payload[k])}>{String(ev.payload[k] ?? "—")}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(ev.mapped_standard ?? {}).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5" /> Campos Salvos no Banco
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(ev.mapped_standard).map(([k, v]) => (
                            <div key={k} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{k}</p>
                              <p className="text-xs text-foreground font-mono truncate">{String(v ?? "—")}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(ev.unmapped ?? {}).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> Campos Não Mapeados
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(ev.unmapped).map(([k, v]) => (
                            <div key={k} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{k}</p>
                              <p className="text-xs text-foreground font-mono truncate">{String(v ?? "—")}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="py-4 flex items-center justify-between border-t border-border bg-card px-4 rounded-2xl">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} eventos no total
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onPageChange((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 text-xs rounded-xl">
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
            </Button>
            <Button size="sm" variant="outline" onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 text-xs rounded-xl">
              Próximo <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/webhooks")({ component: WebhooksPage });


export function WebhooksPage() {
  const qc = useQueryClient();
  const fetchIncoming = useServerFn(listIncomingWebhooks);
  const createIncoming = useServerFn(createIncomingWebhook);
  const updateIncoming = useServerFn(updateIncomingWebhook);
  const duplicateIncoming = useServerFn(duplicateIncomingWebhook);
  const updateIncomingStatus = useServerFn(updateIncomingWebhookStatus);
  const deleteIncoming = useServerFn(deleteIncomingWebhook);
  const regenerateIncomingToken = useServerFn(regenerateIncomingWebhookToken);

  const fetchOutgoing = useServerFn(listOutgoingWebhooks);
  const createOutgoing = useServerFn(createOutgoingWebhook);
  const updateOutgoing = useServerFn(updateOutgoingWebhook);
  const duplicateOutgoing = useServerFn(duplicateOutgoingWebhook);
  const updateOutgoingStatus = useServerFn(updateOutgoingWebhookStatus);
  const deleteOutgoing = useServerFn(deleteOutgoingWebhook);
  const fetchLogs = useServerFn(listOutgoingWebhookLogs);

  const fetchLeads = useServerFn(listWebhookLeads);

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadsViewWebhook, setLeadsViewWebhook] = useState<any | null>(null);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<"all" | "success" | "error">("all");
  const [leadsPage, setLeadsPage] = useState(1);
  const [expandedLeadEventId, setExpandedLeadEventId] = useState<string | null>(null);

  // Modal 1: Novo Webhook de Entrada
  const [incomingDialogOpen, setIncomingDialogOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [incomingName, setIncomingName] = useState("");
  const [createdIncomingUrl, setCreatedIncomingUrl] = useState<string | null>(null);

  // Modal 2: Novo Webhook de Saída
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false);
  const [outgoingUrl, setOutgoingUrl] = useState("");
  const [outgoingEventType, setOutgoingEventType] = useState("LEAD_CREATED");
  const [outgoingRetryCount, setOutgoingRetryCount] = useState(3);

  // Modal 3: Editar Webhook
  const [editingWebhook, setEditingWebhook] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editEventType, setEditEventType] = useState("LEAD_CREATED");
  const [editRetryCount, setEditRetryCount] = useState(3);

  // Modal 4: Confirmação de Exclusão
  const [deletingWebhook, setDeletingWebhook] = useState<{ id: string; name: string; type: "incoming" | "outgoing" } | null>(null);

  // Logs & Field Inspector (Drawer)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<any[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [fieldMappings, setFieldMappings] = useState<any[]>([]);

  const fetchEvents = useServerFn(listIncomingWebhookEvents);
  const saveLabelsFn = useServerFn(updateIncomingWebhookFieldLabels);
  const saveMappingsFn = useServerFn(saveWebhookFieldMappings);
  const fetchStandardFields = useServerFn(listStandardFields);
  const fetchCustomFields = useServerFn(listCustomFields);

  const standardFieldsQ = useQuery({
    queryKey: ["standard-fields"],
    queryFn: () => fetchStandardFields(),
    staleTime: Infinity,
  });

  const customFieldsQ = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => fetchCustomFields(),
    staleTime: 60000,
  });

  const queryEvents = useQuery({
    queryKey: ["webhook-events", selectedWebhook?.id],
    queryFn: () => fetchEvents({ data: { webhook_id: selectedWebhook!.id } }),
    enabled: !!selectedWebhook,
  });

  const queryIncoming = useQuery({
    queryKey: ["webhooks-incoming"],
    queryFn: () => fetchIncoming(),
  });

  const queryOutgoing = useQuery({
    queryKey: ["webhooks-outgoing"],
    queryFn: () => fetchOutgoing(),
  });

  const leadsQ = useQuery({
    queryKey: ["webhook-leads", leadsViewWebhook?.id, leadsStatusFilter, leadsPage],
    queryFn: () =>
      fetchLeads({
        data: {
          webhook_id: leadsViewWebhook!.id,
          page: leadsPage,
          limit: 50,
          status: leadsStatusFilter,
        },
      }),
    enabled: !!leadsViewWebhook,
  });

  const saveMappingsMut = useMutation({
    mutationFn: () =>
      saveMappingsFn({
        data: {
          webhook_id: selectedWebhook!.id,
          mappings: fieldMappings,
        },
      }),
    onSuccess: async () => {
      toast.success("Mapeamentos salvos no banco de dados com sucesso!");
      const freshData = await queryIncoming.refetch();
      // Sincroniza o selectedWebhook com os dados atualizados do cache
      // para que o useEffect não sobrescreva os mapeamentos recém-salvos
      if (selectedWebhook && freshData.data) {
        const freshWebhook = (freshData.data as any[]).find((w: any) => w.id === selectedWebhook.id);
        if (freshWebhook) {
          setSelectedWebhook(freshWebhook);
        }
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar mapeamentos"),
  });

  const discoveredFields = (queryEvents.data as any)?.discovered_fields ?? [];
  const events = (queryEvents.data as any)?.events ?? [];

  // Carrega os mapeamentos APENAS quando o painel é aberto pela primeira vez
  // (selectedWebhook.id muda). Não sobrescreve quando selectedWebhook é atualizado
  // internamente após um refetch com dados já salvos.
  const selectedWebhookId = selectedWebhook?.id;
  useEffect(() => {
    if (selectedWebhook) {
      const existing = selectedWebhook.field_labels;
      setFieldLabels(
        existing && existing !== "null"
          ? typeof existing === "string"
            ? JSON.parse(existing)
            : existing
          : {}
      );
      const mappings = selectedWebhook.webhook_field_mappings;
      if (mappings && Array.isArray(mappings) && mappings.length > 0) {
        setFieldMappings(mappings);
      } else {
        setFieldMappings([
          { external_field: "nome", target_type: "standard", target_key: "name", custom_field_id: null },
          { external_field: "email", target_type: "standard", target_key: "email", custom_field_id: null },
          { external_field: "telefone", target_type: "standard", target_key: "phone", custom_field_id: null },
        ]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWebhookId]);

  const createIncomingMut = useMutation({
    mutationFn: () => createIncoming({ data: { name: incomingName } }),
    onSuccess: (r: any) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
      const generatedUrl = `${origin}/api/public/webhooks/incoming/${r.token}`;
      setCreatedIncomingUrl(generatedUrl);
      setModalStep(2);
      queryIncoming.refetch();
      toast.success("Webhook de entrada criado!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar webhook"),
  });

  const updateIncomingMut = useMutation({
    mutationFn: () => updateIncoming({ data: { id: editingWebhook.id, name: editName } }),
    onSuccess: () => {
      toast.success("Webhook atualizado!");
      setEditingWebhook(null);
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar webhook"),
  });

  const duplicateIncomingMut = useMutation({
    mutationFn: (id: string) => duplicateIncoming({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook duplicado com sucesso!");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao duplicar webhook"),
  });

  const createOutgoingMut = useMutation({
    mutationFn: () =>
      createOutgoing({
        data: {
          url: outgoingUrl,
          event_type: outgoingEventType as any,
          retry_count: outgoingRetryCount,
        },
      }),
    onSuccess: () => {
      toast.success("Webhook de saída criado!");
      setOutgoingDialogOpen(false);
      setOutgoingUrl("");
      setOutgoingEventType("LEAD_CREATED");
      setOutgoingRetryCount(3);
      queryOutgoing.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar webhook"),
  });

  const updateOutgoingMut = useMutation({
    mutationFn: () =>
      updateOutgoing({
        data: {
          id: editingWebhook.id,
          url: editUrl,
          event_type: editEventType,
          retry_count: editRetryCount,
        },
      }),
    onSuccess: () => {
      toast.success("Webhook de saída atualizado!");
      setEditingWebhook(null);
      queryOutgoing.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar webhook"),
  });

  const duplicateOutgoingMut = useMutation({
    mutationFn: (id: string) => duplicateOutgoing({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook duplicado com sucesso!");
      queryOutgoing.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao duplicar webhook"),
  });

  const toggleIncomingMut = useMutation({
    mutationFn: (vars: { id: string; status: "listening" | "paused" }) =>
      updateIncomingStatus({ data: vars }),
    onSuccess: () => {
      queryIncoming.refetch();
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIncomingMut = useMutation({
    mutationFn: (id: string) => deleteIncoming({ data: { id } }),
    onSuccess: () => {
      queryIncoming.refetch();
      setDeletingWebhook(null);
      toast.success("Webhook de entrada excluído.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const regenerateMut = useMutation({
    mutationFn: (id: string) => regenerateIncomingToken({ data: { id } }),
    onSuccess: () => {
      toast.success("Novo token gerado!");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleOutgoingMut = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "paused" }) =>
      updateOutgoingStatus({ data: vars }),
    onSuccess: () => {
      queryOutgoing.refetch();
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOutgoingMut = useMutation({
    mutationFn: (id: string) => deleteOutgoing({ data: { id } }),
    onSuccess: () => {
      queryOutgoing.refetch();
      setDeletingWebhook(null);
      toast.success("Webhook removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openLogs = async (webhookId: string) => {
    setLoadingLogs(true);
    setLogsDialogOpen(true);
    try {
      const logs = await fetchLogs({ data: { webhook_id: webhookId } });
      setCurrentLogs(logs as any[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  usePageHeader({});

  const incomingList = (queryIncoming.data as any[]) || [];
  const outgoingList = (queryOutgoing.data as any[]) || [];

  const filteredIncoming = incomingList.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOutgoing = outgoingList.filter((w) =>
    w.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.event_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function timeAgo(dateString?: string | null) {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "agora mesmo";
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
    const days = Math.floor(diffInSeconds / 86400);
    return `há ${days} dias`;
  }

  if (leadsViewWebhook) {
    return (
      <div className="flex-1 bg-background text-foreground p-6 space-y-6 min-h-screen">
        <WebhookLeadsPanel
          webhook={leadsViewWebhook}
          statusFilter={leadsStatusFilter}
          page={leadsPage}
          expandedId={expandedLeadEventId}
          leadsQ={leadsQ}
          onClose={() => setLeadsViewWebhook(null)}
          onStatusChange={(f) => { setLeadsStatusFilter(f); setLeadsPage(1); }}
          onPageChange={setLeadsPage}
          onExpandToggle={(id) => setExpandedLeadEventId(id)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background text-foreground p-6 space-y-6 min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Webhooks</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure endpoints para capturar novos leads e notificar sistemas externos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-card border-border rounded-xl"
            />
          </div>

          <Button
            onClick={() => {
              if (activeTab === "incoming") {
                setModalStep(1);
                setIncomingName("");
                setCreatedIncomingUrl(null);
                setIncomingDialogOpen(true);
              } else {
                setOutgoingDialogOpen(true);
              }
            }}
            className="bg-brand-gradient text-white font-bold shadow-md hover:opacity-95 px-5 text-xs rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Novo Webhook
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("incoming")}
          className={`pb-3 text-sm font-display font-semibold transition-all relative ${
            activeTab === "incoming"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Webhooks de Entrada
        </button>

        <button
          onClick={() => setActiveTab("outgoing")}
          className={`pb-3 text-sm font-display font-semibold transition-all relative ${
            activeTab === "outgoing"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Webhooks de Saída
        </button>
      </div>

      {/* Content Tab 1: Webhooks de Entrada */}
      {activeTab === "incoming" && (
        <div>
          {queryIncoming.isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Carregando webhooks de entrada...</div>
          ) : filteredIncoming.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/40">
              <Webhook className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <h3 className="text-sm font-bold text-foreground">Nenhum webhook de entrada configurado</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Crie um webhook para receber leads automaticamente de formulários ou landing páginas.
              </p>
              <Button
                onClick={() => {
                  setModalStep(1);
                  setIncomingName("");
                  setCreatedIncomingUrl(null);
                  setIncomingDialogOpen(true);
                }}
                className="mt-4 bg-brand-gradient text-white text-xs font-bold px-4"
              >
                <Plus className="w-4 h-4 mr-1" /> Criar Primeiro Webhook
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIncoming.map((wh) => (
                <Card
                  key={wh.id}
                  onClick={() => {
                    setLeadsViewWebhook(wh);
                    setLeadsStatusFilter("all");
                    setLeadsPage(1);
                    setExpandedLeadEventId(null);
                  }}
                  className="border border-border bg-card hover:border-primary/50 transition-all shadow-xs group rounded-2xl overflow-hidden cursor-pointer"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                          <Webhook className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {wh.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                wh.status === "listening" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                              }`}
                            />
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {wh.status === "listening" ? "Escutando" : "Pausado"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* MENU DE 3 PONTINHOS (DROPDOWN) */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover border-border rounded-xl shadow-lg p-1">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingWebhook({ ...wh, type: "incoming" });
                                setEditName(wh.name);
                              }}
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2 text-primary" /> Editar Webhook
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => duplicateIncomingMut.mutate(wh.id)}
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              <Files className="h-3.5 w-3.5 mr-2 text-primary" /> Duplicar Webhook
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
                                const url = `${origin}/api/public/webhooks/incoming/${wh.token}`;
                                navigator.clipboard.writeText(url).then(() => toast.success("URL copiada!"));
                              }}
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar URL
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setSelectedWebhook(wh)}
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              <Settings className="h-3.5 w-3.5 mr-2 text-primary" /> Mapear Campos
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => regenerateMut.mutate(wh.id)}
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Regenerar Token
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() =>
                                toggleIncomingMut.mutate({
                                  id: wh.id,
                                  status: wh.status === "listening" ? "paused" : "listening",
                                })
                              }
                              className="text-xs cursor-pointer rounded-lg py-2"
                            >
                              {wh.status === "listening" ? (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" /> Pausar Webhook
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Ativar Webhook
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-border" />

                            <DropdownMenuItem
                              onClick={() => setDeletingWebhook({ id: wh.id, name: wh.name, type: "incoming" })}
                              className="text-xs cursor-pointer rounded-lg py-2 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar Webhook
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-xs font-semibold text-foreground pt-1 border-t border-border/60">
                      <div>
                        <span className="text-foreground font-bold">{wh.events_count || 0}</span>{" "}
                        <span className="text-muted-foreground font-normal">eventos</span>
                      </div>
                      <div>
                        <span className="text-foreground font-bold">{wh.leads_count || 0}</span>{" "}
                        <span className="text-muted-foreground font-normal">leads</span>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {timeAgo(wh.last_event_at || wh.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground/50 group-hover:text-primary font-medium flex items-center gap-0.5 transition-colors">
                        Ver Leads <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Tab 2: Webhooks de Saída */}
      {activeTab === "outgoing" && (
        <div>
          {queryOutgoing.isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Carregando webhooks de saída...</div>
          ) : filteredOutgoing.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/40">
              <Send className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <h3 className="text-sm font-bold text-foreground">Nenhum webhook de saída configurado</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Dispare notificações para o n8n, Make ou Zapier quando um evento acontecer na Bliv.
              </p>
              <Button
                onClick={() => setOutgoingDialogOpen(true)}
                className="mt-4 bg-brand-gradient text-white text-xs font-bold px-4"
              >
                <Plus className="w-4 h-4 mr-1" /> Criar Webhook de Saída
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOutgoing.map((wh) => (
                <Card
                  key={wh.id}
                  className="border border-border bg-card hover:border-primary/50 transition-all shadow-xs rounded-2xl overflow-hidden p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Send className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-display font-bold text-xs text-foreground truncate max-w-[180px]" title={wh.url}>
                          {wh.url}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            {wh.event_type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {wh.retry_count} retentativa(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* MENU DE 3 PONTINHOS (OUTGOING) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-popover border-border rounded-xl shadow-lg p-1">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingWebhook({ ...wh, type: "outgoing" });
                            setEditUrl(wh.url);
                            setEditEventType(wh.event_type);
                            setEditRetryCount(wh.retry_count || 3);
                          }}
                          className="text-xs cursor-pointer rounded-lg py-2"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2 text-primary" /> Editar Webhook
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => duplicateOutgoingMut.mutate(wh.id)}
                          className="text-xs cursor-pointer rounded-lg py-2"
                        >
                          <Files className="h-3.5 w-3.5 mr-2 text-primary" /> Duplicar Webhook
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => openLogs(wh.id)}
                          className="text-xs cursor-pointer rounded-lg py-2"
                        >
                          <Activity className="h-3.5 w-3.5 mr-2" /> Ver Logs
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() =>
                            toggleOutgoingMut.mutate({
                              id: wh.id,
                              status: wh.status === "active" ? "paused" : "active",
                            })
                          }
                          className="text-xs cursor-pointer rounded-lg py-2"
                        >
                          {wh.status === "active" ? (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" /> Pausar Webhook
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Ativar Webhook
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-border" />

                        <DropdownMenuItem
                          onClick={() => setDeletingWebhook({ id: wh.id, name: wh.url, type: "outgoing" })}
                          className="text-xs cursor-pointer rounded-lg py-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar Webhook
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          wh.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"
                        }`}
                      />
                      <span className="text-xs font-bold text-foreground">
                        {wh.status === "active" ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: NOVO WEBHOOK DE ENTRADA */}
      <Dialog
        open={incomingDialogOpen}
        onOpenChange={(open) => {
          setIncomingDialogOpen(open);
          if (!open) {
            setModalStep(1);
            setCreatedIncomingUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border rounded-2xl shadow-xl">
          <div className="bg-brand-gradient p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Webhook className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-display text-white">
                  Novo Webhook
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80 mt-0.5">
                  Configure um endpoint para receber leads
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 pt-5 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  modalStep === 1 ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white"
                }`}
              >
                1
              </div>
              <span className="text-xs font-semibold text-foreground">Informações básicas</span>
            </div>

            <div className="h-0.5 w-12 bg-border" />

            <div className="flex items-center gap-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  modalStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span className="text-xs font-semibold text-muted-foreground">Webhook criado</span>
            </div>
          </div>

          {modalStep === 1 && (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Dê um nome ao seu webhook
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Escolha um nome que identifique a origem dos leads, como "Landing Page Principal" ou "Formulário de Contato".
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-foreground">Nome do Webhook</Label>
                <Input
                  placeholder="Ex: Landing Page, Formulário Site..."
                  value={incomingName}
                  onChange={(e) => setIncomingName(e.target.value)}
                  className="bg-background border-border text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setIncomingDialogOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={() => createIncomingMut.mutate()}
                  disabled={!incomingName.trim() || createIncomingMut.isPending}
                  className="bg-brand-gradient text-white text-xs font-bold rounded-xl px-5"
                >
                  {createIncomingMut.isPending ? "Criando..." : "Criar Webhook →"}
                </Button>
              </div>
            </div>
          )}

          {modalStep === 2 && createdIncomingUrl && (
            <div className="p-6 space-y-5 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <Webhook className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold font-display text-foreground">
                  Webhook criado com sucesso!
                </h4>
                <p className="text-xs text-muted-foreground">
                  Use a URL abaixo para enviar dados ao seu webhook via requisição HTTP POST.
                </p>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 text-left space-y-1.5 shadow-xs">
                <span className="text-[11px] font-bold text-muted-foreground block">
                  URL do Webhook (POST)
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdIncomingUrl}
                    className="font-mono text-xs bg-card border-border truncate"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      navigator.clipboard.writeText(createdIncomingUrl).then(() => toast.success("URL copiada!"))
                    }
                    className="bg-brand-gradient text-white text-xs font-bold rounded-lg shrink-0 px-3"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setIncomingDialogOpen(false)}
                  className="w-full bg-brand-gradient text-white text-xs font-bold rounded-xl py-2.5"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: NOVO WEBHOOK DE SAÍDA */}
      <Dialog open={outgoingDialogOpen} onOpenChange={setOutgoingDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-foreground">
              Novo Webhook de Saída
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispare notificações para um endpoint externo (n8n, Make, Zapier).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">URL de destino (Endpoint)</Label>
              <Input
                placeholder="https://n8n.suaempresa.com/webhook/..."
                value={outgoingUrl}
                onChange={(e) => setOutgoingUrl(e.target.value)}
                className="bg-background border-border text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Tipo de Evento Disparador</Label>
              <Select value={outgoingEventType} onValueChange={setOutgoingEventType}>
                <SelectTrigger className="bg-background border-border text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="LEAD_CREATED">Lead Criado (LEAD_CREATED)</SelectItem>
                  <SelectItem value="DEAL_STEP_CHANGED">Estágio do Funil Alterado (DEAL_STEP_CHANGED)</SelectItem>
                  <SelectItem value="MESSAGE_RECEIVED">Mensagem Recebida (MESSAGE_RECEIVED)</SelectItem>
                  <SelectItem value="AGENT_HANDOFF">Transbordo para Humano (AGENT_HANDOFF)</SelectItem>
                  <SelectItem value="DEAL_WON">Negócio Ganho (DEAL_WON)</SelectItem>
                  <SelectItem value="DEAL_LOST">Negócio Perdido (DEAL_LOST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Número de Retentativas</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={outgoingRetryCount}
                onChange={(e) => setOutgoingRetryCount(Number(e.target.value))}
                className="bg-background border-border text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOutgoingDialogOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>

            <Button
              onClick={() => createOutgoingMut.mutate()}
              disabled={!outgoingUrl.trim() || createOutgoingMut.isPending}
              className="bg-brand-gradient text-white text-xs font-bold rounded-xl px-5"
            >
              {createOutgoingMut.isPending ? "Criando..." : "Criar Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EDITAR WEBHOOK */}
      <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && setEditingWebhook(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-foreground">
              Editar Webhook
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Atualize as configurações do webhook no banco de dados.
            </DialogDescription>
          </DialogHeader>

          {editingWebhook?.type === "incoming" ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Nome do Webhook</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-background border-border text-xs rounded-xl"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">URL de Destino</Label>
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="bg-background border-border text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Tipo de Evento</Label>
                <Select value={editEventType} onValueChange={setEditEventType}>
                  <SelectTrigger className="bg-background border-border text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-xs">
                    <SelectItem value="LEAD_CREATED">Lead Criado (LEAD_CREATED)</SelectItem>
                    <SelectItem value="DEAL_STEP_CHANGED">Estágio do Funil Alterado (DEAL_STEP_CHANGED)</SelectItem>
                    <SelectItem value="MESSAGE_RECEIVED">Mensagem Recebida (MESSAGE_RECEIVED)</SelectItem>
                    <SelectItem value="AGENT_HANDOFF">Transbordo para Humano (AGENT_HANDOFF)</SelectItem>
                    <SelectItem value="DEAL_WON">Negócio Ganho (DEAL_WON)</SelectItem>
                    <SelectItem value="DEAL_LOST">Negócio Perdido (DEAL_LOST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Retentativas</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={editRetryCount}
                  onChange={(e) => setEditRetryCount(Number(e.target.value))}
                  className="bg-background border-border text-xs rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWebhook(null)} className="text-xs rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingWebhook?.type === "incoming") {
                  updateIncomingMut.mutate();
                } else {
                  updateOutgoingMut.mutate();
                }
              }}
              className="bg-brand-gradient text-white text-xs font-bold rounded-xl px-5"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={!!deletingWebhook} onOpenChange={(open) => !open && setDeletingWebhook(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-destructive">
              Excluir Webhook
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja excluir o webhook "{deletingWebhook?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingWebhook(null)} className="text-xs rounded-xl">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deletingWebhook) return;
                if (deletingWebhook.type === "incoming") {
                  deleteIncomingMut.mutate(deletingWebhook.id);
                } else {
                  deleteOutgoingMut.mutate(deletingWebhook.id);
                }
              }}
              className="text-xs rounded-xl font-bold"
            >
              Sim, Excluir Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHEET 1: MAPEAR CAMPOS DO WEBHOOK (VISUAL 2-COLUMN MAPPER) */}
      <Sheet open={!!selectedWebhook} onOpenChange={(open) => !open && setSelectedWebhook(null)}>
        <SheetContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="w-full sm:max-w-xl bg-card border-l border-border p-6 flex flex-col h-full gap-4 overflow-y-auto"
        >
          <SheetHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold font-display text-foreground">
                  Conexão de Campos (Payload → Banco MySQL)
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedWebhook?.name}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 flex-1 overflow-y-auto pr-1">
            {/* Box Exemplo cURL / Endpoint */}
            <div className="bg-background border border-border rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> URL do Webhook (POST)
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
                    const url = `${origin}/api/public/webhooks/incoming/${selectedWebhook?.token}`;
                    navigator.clipboard.writeText(url).then(() => toast.success("URL copiada!"));
                  }}
                  className="h-7 text-[11px] text-primary hover:bg-primary/10"
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar URL
                </Button>
              </div>

              <div className="bg-card p-2.5 rounded-lg border border-border font-mono text-[11px] text-muted-foreground break-all">
                {typeof window !== "undefined" ? window.location.origin : "http://localhost:8080"}/api/public/webhooks/incoming/{selectedWebhook?.token}
              </div>
            </div>

            {/* Box Snippet de Formulário (Embed) — estilo RD Station */}
            {selectedWebhook?.token && <EmbedSnippetBox token={selectedWebhook.token} />}

            {/* Secao 1: Rótulos e Mapeamentos dos Campos Descobertos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold font-display text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-primary" /> Conexão Direta de Campos
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Associe cada chave do JSON que chega ao campo correspondente que vai salvá-la no banco.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => saveMappingsMut.mutate()}
                  disabled={saveMappingsMut.isPending}
                  className="bg-brand-gradient text-white text-xs font-bold h-8 px-3.5 rounded-xl shadow-md hover:opacity-95"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar no Banco
                </Button>
              </div>

              {/* Lista de Mapeamentos Ativos */}
              <div className="space-y-3">
                {fieldMappings.map((mapItem, idx) => (
                  <div key={idx} className="bg-background border border-border rounded-xl p-3.5 flex items-center gap-2.5 shadow-xs transition-all hover:border-primary/40">
                    {/* Campo de Entrada (Payload JSON) */}
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground block">
                        Chave do Payload JSON
                      </span>
                      <Input
                        placeholder="ex: nome, email, whatsapp"
                        value={mapItem.external_field || ""}
                        onChange={(e) => {
                          const updated = [...fieldMappings];
                          updated[idx] = { ...mapItem, external_field: e.target.value };
                          setFieldMappings(updated);
                        }}
                        className="bg-card border-border text-xs rounded-lg font-mono text-foreground"
                      />
                    </div>

                    {/* Ícone de Conexão */}
                    <div className="pt-4 text-primary shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </div>

                    {/* Campo de Destino no Banco de Dados */}
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground block">
                        Campo no Banco (MySQL)
                      </span>
                      <Select
                        value={mapItem.target_type === "custom" ? `custom:${mapItem.custom_field_id}` : `standard:${mapItem.target_key || "name"}`}
                        onValueChange={(val) => {
                          const updated = [...fieldMappings];
                          if (val.startsWith("custom:")) {
                            const cfId = val.replace("custom:", "");
                            updated[idx] = {
                              ...mapItem,
                              target_type: "custom",
                              custom_field_id: cfId,
                              target_key: null,
                            };
                          } else {
                            const stdKey = val.replace("standard:", "");
                            updated[idx] = {
                              ...mapItem,
                              target_type: "standard",
                              target_key: stdKey,
                              custom_field_id: null,
                            };
                          }
                          setFieldMappings(updated);
                        }}
                      >
                        <SelectTrigger className="bg-card border-border text-xs rounded-lg font-medium text-foreground">
                          <SelectValue placeholder="Selecione o campo..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border text-xs">
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                            Campos Padrão do Banco
                          </div>
                          {(standardFieldsQ.data || []).map((sf: any) => (
                            <SelectItem key={`std_${sf.key}`} value={`standard:${sf.key}`}>
                              {sf.label} ({sf.key})
                            </SelectItem>
                          ))}

                          {(customFieldsQ.data || []).length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase pt-2 border-t border-border mt-1">
                                Campos Personalizados
                              </div>
                              {(customFieldsQ.data || []).map((cf: any) => (
                                <SelectItem key={`cf_${cf.id}`} value={`custom:${cf.id}`}>
                                  {cf.label} ({cf.key})
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botão Remover Mapeamento */}
                    <div className="pt-4 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFieldMappings(fieldMappings.filter((_, i) => i !== idx));
                        }}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFieldMappings([
                      ...fieldMappings,
                      {
                        external_field: "",
                        target_type: "standard",
                        target_key: "name",
                        custom_field_id: null,
                      },
                    ]);
                  }}
                  className="w-full text-xs font-bold rounded-xl border-dashed border-border hover:border-primary/50 text-foreground py-2.5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" /> Adicionar Mapeamento de Campo
                </Button>
              </div>

              {/* Descoberta de Campos Recebidos nos Eventos do Webhook */}
              {discoveredFields.length > 0 && (
                <div className="pt-3 space-y-2 border-t border-border">
                  <h5 className="text-xs font-bold text-foreground">
                    Campos Detectados nos Eventos Recentes ({discoveredFields.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {discoveredFields.map((fKey: string) => (
                      <Badge
                        key={fKey}
                        variant="outline"
                        onClick={() => {
                          const exists = fieldMappings.some((m) => m.external_field === fKey);
                          if (!exists) {
                            setFieldMappings([
                              ...fieldMappings,
                              {
                                external_field: fKey,
                                target_type: "standard",
                                target_key: fKey === "email" ? "email" : fKey.includes("phone") || fKey.includes("telef") || fKey.includes("zap") ? "phone" : "name",
                                custom_field_id: null,
                              },
                            ]);
                            toast.success(`Campo "${fKey}" adicionado ao mapeamento.`);
                          }
                        }}
                        className="cursor-pointer hover:bg-primary/10 hover:border-primary text-xs font-mono"
                      >
                        + {fKey}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Secao 2: Histórico de Eventos do Webhook */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-xs font-bold font-display text-foreground uppercase tracking-wider">
                Eventos Recebidos Recentemente
              </h4>

              {queryEvents.isLoading ? (
                <div className="text-center py-4 text-xs text-muted-foreground">Carregando eventos...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-xl bg-background text-xs text-muted-foreground">
                  Nenhum evento recebido ainda neste endpoint.
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((ev: any) => {
                    const isExpanded = expandedEventId === ev.id;
                    return (
                      <div key={ev.id} className="bg-background border border-border rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                          <div className="flex items-center gap-2">
                            <Badge className={ev.status === "success" || ev.status === "processed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold" : "bg-destructive/10 text-destructive"}>
                              {ev.status === "success" || ev.status === "processed" ? "Recebido (200 OK)" : ev.status}
                            </Badge>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                              className="h-6 text-[11px] text-primary px-2 rounded-md hover:bg-primary/10 font-medium"
                            >
                              {isExpanded ? "Ocultar JSON" : "Ver JSON"}
                            </Button>
                          </div>
                        </div>

                        {ev.fields && ev.fields.length > 0 && (
                          <div className="text-[11px] text-muted-foreground font-mono truncate">
                            Campos: <span className="text-foreground font-medium">{ev.fields.join(", ")}</span>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="pt-2 border-t border-border space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                Payload JSON Computado
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(ev.payload || {}, null, 2));
                                  toast.success("Payload JSON copiado!");
                                }}
                                className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                <Copy className="h-3 w-3 mr-1" /> Copiar JSON
                              </Button>
                            </div>

                            <pre className="bg-card p-3 rounded-xl border border-border font-mono text-[11px] text-foreground overflow-x-auto max-h-48 leading-relaxed shadow-inner">
                              {JSON.stringify(ev.payload || {}, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* DIALOG DE LOGS DO OUTGOING WEBHOOK */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-bold text-foreground">
              Logs de Disparo do Webhook
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Histórico de envios para a URL de destino.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {loadingLogs ? (
              <div className="text-center py-6 text-xs text-muted-foreground">Carregando logs...</div>
            ) : !currentLogs || currentLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">Nenhum log registrado até o momento.</div>
            ) : (
              currentLogs.map((log: any) => (
                <div key={log.id} className="bg-background border border-border rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    <Badge className={log.response_status >= 200 && log.response_status < 300 ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}>
                      HTTP {log.response_status || "Erro"}
                    </Badge>
                  </div>
                  {log.error_message && (
                    <div className="text-[11px] text-destructive font-mono">{log.error_message}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
