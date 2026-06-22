import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllTemplates,
  syncTemplatesFromMeta,
  seedSampleTemplates,
  deleteTemplate,
  deleteTemplatesBulk,
  submitTemplateToMeta,
  getMetaTemplateDetails,
  listMetaTemplatesDirect,
} from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import {
  RefreshCw,
  Sparkles,
  FileText,
  Plus,
  Trash2,
  X,
  Info,
  Megaphone,
  Bell,
  ShieldCheck,
  Wallet,
  ChevronDown,
  Send,
  Pencil,
  MoreVertical,
  CheckSquare,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { CardGridSkeleton } from "@/components/table-skeleton";
import { TemplateBuilderDialog } from "@/components/template-builder-dialog";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/templates")({ component: TemplatesPage });

const statusColors: Record<string, string> = {
  APPROVED: "bg-success/15 text-success",
  PENDING: "bg-warning/15 text-warning-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  PAUSED: "bg-muted text-muted-foreground",
  DISABLED: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  APPROVED: "APROVADO",
  PENDING: "PENDENTE",
  REJECTED: "REJEITADO",
  PAUSED: "PAUSADO",
  DISABLED: "DESATIVADO",
};

function TemplateDetailsDialog({
  trigger,
  templateId,
  metaTemplateId,
}: {
  trigger: ReactNode;
  templateId?: string;
  metaTemplateId?: string;
}) {
  const fetchDetails = useServerFn(getMetaTemplateDetails);
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["meta-template-details", templateId, metaTemplateId],
    queryFn: () => fetchDetails({ data: { id: templateId, meta_template_id: metaTemplateId } }),
    enabled: open,
  });

  const qualityScoreColors: Record<string, string> = {
    GREEN: "bg-success/15 text-success border-success/30",
    YELLOW: "bg-warning/15 text-warning border-warning/30",
    RED: "bg-destructive/15 text-destructive border-destructive/30",
    UNKNOWN: "bg-muted text-muted-foreground border-muted-foreground/30",
  };

  const qualityScoreLabels: Record<string, string> = {
    GREEN: "Alta (Verde)",
    YELLOW: "Média (Amarelo)",
    RED: "Baixa (Vermelho)",
    UNKNOWN: "Desconhecida",
  };

  const rejectedReasons: Record<string, string> = {
    ABUSIVE_CONTENT: "Conteúdo abusivo ou violador das políticas de comércio do WhatsApp.",
    CATEGORY_NOT_AVAILABLE: "A categoria selecionada não está disponível.",
    INCORRECT_CATEGORY: "A categoria selecionada está incorreta para este tipo de mensagem.",
    INVALID_FORMAT: "Formatação inválida nas variáveis ou tags HTML não suportadas.",
    PROMOTIONAL: "Conteúdo promocional inadequado para a categoria solicitada.",
    SCAM: "Suspeita de golpe, phishing ou spam.",
    TAG_CONTENT_MISMATCH: "Incompatibilidade entre a tag selecionada e o conteúdo textual.",
    NONE: "Nenhum motivo reportado.",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Visualizar Detalhes da Meta</span>
          </DialogTitle>
          <DialogDescription>
            Informações em tempo real consultadas diretamente da Meta Graph API.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Buscando informações em tempo real…</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
            <strong>Erro ao obter detalhes:</strong> {(error as any).message ?? "Falha de comunicação com a API da Meta."}
          </div>
        )}

        {data && (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3.5 space-y-1 bg-muted/10">
                  <span className="text-xs font-medium text-muted-foreground">ID do Template</span>
                  <p className="font-mono text-xs break-all select-all font-semibold">{data.id}</p>
                </div>
                <div className="rounded-lg border p-3.5 space-y-1 bg-muted/10">
                  <span className="text-xs font-medium text-muted-foreground">Nome Interno</span>
                  <p className="text-sm font-semibold select-all">{data.name}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Categoria</span>
                  <p className="text-sm font-semibold">{data.category}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Idioma</span>
                  <p className="text-sm font-semibold">{data.language}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <p className="text-sm font-semibold">{data.status}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3.5 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Score de Qualidade</span>
                  <div className="pt-0.5">
                    <span className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      qualityScoreColors[data.quality_score?.score] || qualityScoreColors.UNKNOWN
                    )}>
                      {qualityScoreLabels[data.quality_score?.score] || qualityScoreLabels.UNKNOWN}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border p-3.5 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Pode Enviar Mensagem</span>
                  <p className="text-sm font-semibold">
                    {data.health_status?.can_send_message === "true" || data.health_status?.can_send_message === true || data.status === "APPROVED" ? (
                      <span className="text-success">Sim (Ativo)</span>
                    ) : (
                      <span className="text-destructive">Não (Bloqueado)</span>
                    )}
                  </p>
                </div>
              </div>

              {data.status === "REJECTED" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-1.5 text-sm">
                  <span className="font-semibold text-destructive">Motivo da Rejeição:</span>
                  <p className="font-medium">{data.rejected_reason}</p>
                  <p className="text-xs text-muted-foreground pt-1 border-t border-destructive/20">
                    💡 <strong>O que significa?</strong> {rejectedReasons[data.rejected_reason] || "Análise e ajustes no texto ou botões são necessários para reenviar o template."}
                  </p>
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3 bg-muted/5">
                <h4 className="text-sm font-semibold">Configurações Avançadas</h4>
                <div className="grid gap-4 text-xs sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Formato dos Parâmetros:</span>
                    <p className="font-medium">{data.parameter_format || "Posicional (Padrão)"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Validade das Mensagens (TTL):</span>
                    <p className="font-medium">
                      {data.message_send_ttl_seconds
                        ? `${data.message_send_ttl_seconds} segundos (~${Math.round(data.message_send_ttl_seconds / 3600)} horas)`
                        : "Sem expiração personalizada"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Rastreamento de Cliques em CTA:</span>
                    <p className="font-medium">
                      {data.cta_url_link_tracking_opted_out ? "Desativado (Opted Out)" : "Ativo (Padrão)"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Entrega em Dispositivo Primário:</span>
                    <p className="font-medium">
                      {data.is_primary_device_delivery_only ? "Sim, exclusiva" : "Não (Todos os dispositivos)"}
                    </p>
                  </div>
                  {data.sub_category && (
                    <div className="space-y-0.5 sm:col-span-2">
                      <span className="text-muted-foreground">Sub-categoria:</span>
                      <p className="font-medium">{data.sub_category}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Layout no WhatsApp</p>
              <div className="sticky top-0">
                <WhatsAppPreview components={data.components ?? []} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplatesPage() {
  const fetch = useServerFn(listAllTemplates);
  const sync = useServerFn(syncTemplatesFromMeta);
  const seed = useServerFn(seedSampleTemplates);
  const remove = useServerFn(deleteTemplate);
  const removeBulk = useServerFn(deleteTemplatesBulk);
  const submitMeta = useServerFn(submitTemplateToMeta);
  const fetchDirect = useServerFn(listMetaTemplatesDirect);

  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["templates", "all"], queryFn: () => fetch() });
  
  const [activeTab, setActiveTab] = useState<"db" | "meta">("db");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [cursorAfter, setCursorAfter] = useState<string | undefined>(undefined);
  const [cursorBefore, setCursorBefore] = useState<string | undefined>(undefined);

  const [deleteTemplateItem, setDeleteTemplateItem] = useState<any>(null);
  const [deleteMode, setDeleteMode] = useState<"single" | "all">("single");

  const { data: metaData, isLoading: isLoadingMeta, error: metaError } = useQuery({
    queryKey: ["templates", "meta", cursorAfter, cursorBefore],
    queryFn: () => fetchDirect({ data: { limit: 12, after: cursorAfter, before: cursorBefore } }),
    enabled: activeTab === "meta",
  });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      toast.success(`${r.synced} templates sincronizados`);
      qc.invalidateQueries({ queryKey: ["templates", "all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => {
      toast.success(`${r.inserted} templates de exemplo adicionados`);
      qc.invalidateQueries({ queryKey: ["templates", "all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (ids: string[]) => removeBulk({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} templates excluídos`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["templates", "all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitMeta({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Template "${r.name}" enviado com sucesso! Status na Meta: ${r.status}`);
      qc.invalidateQueries({ queryKey: ["templates", "all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((t: any) => {
      const matchesSearch =
        !s ||
        t.name.toLowerCase().includes(s) ||
        t.status.toLowerCase().includes(s) ||
        (t.category ?? "").toLowerCase().includes(s);
      const matchesCategory =
        !categoryFilter || (t.category ?? "").toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = !statusFilter || t.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [data, search, categoryFilter, statusFilter]);

  const filteredMeta = useMemo(() => {
    const s = search.toLowerCase();
    return (metaData?.data ?? []).filter((t: any) => {
      const matchesSearch =
        !s ||
        t.name.toLowerCase().includes(s) ||
        t.status.toLowerCase().includes(s) ||
        (t.category ?? "").toLowerCase().includes(s);
      const matchesCategory =
        !categoryFilter || (t.category ?? "").toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = !statusFilter || t.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [metaData, search, categoryFilter, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((t: any) => selected.has(t.id));
  const someSelected = selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((t: any) => t.id)));
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${ids.length} templates?`,
      description: (
        <>
          Os templates selecionados serão removidos aqui e na Meta (quando aplicável). Esta ação não
          pode ser desfeita.
        </>
      ),
      destructive: true,
      confirmText: "Excluir todos",
    });
    if (!ok) return;
    bulkMut.mutate(ids);
  }

  async function singleDelete(t: any) {
    const isRemote =
      t.meta_template_id &&
      !t.meta_template_id.startsWith("sample_") &&
      !t.meta_template_id.startsWith("local_");

    if (isRemote) {
      setDeleteTemplateItem(t);
      setDeleteMode("single");
    } else {
      const ok = await confirm({
        title: "Excluir template?",
        description: (
          <>
            O template <strong>{t.name}</strong> será removido do banco de dados local.
          </>
        ),
        destructive: true,
        confirmText: "Excluir",
      });
      if (!ok) return;
      try {
        await remove({ data: { id: t.id, deleteMode: "single" } });
        toast.success("Template local removido");
        qc.invalidateQueries({ queryKey: ["templates", "all"] });
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  }

  async function deleteFromMetaDirect(t: any) {
    const localMatch = (data ?? []).find((l: any) => l.name === t.name && l.language === t.language);
    if (localMatch?.id) {
      setDeleteTemplateItem({ id: localMatch.id, name: t.name, language: t.language });
      setDeleteMode("single");
    } else {
      toast.loading("Sincronizando banco de dados...");
      try {
        await sync();
        const updated = await fetch();
        const newMatch = (updated ?? []).find((l: any) => l.name === t.name && l.language === t.language);
        toast.dismiss();
        if (newMatch?.id) {
          setDeleteTemplateItem({ id: newMatch.id, name: t.name, language: t.language });
          setDeleteMode("single");
        } else {
          toast.error("Template não encontrado no banco de dados após sincronização.");
        }
      } catch (err: any) {
        toast.dismiss();
        toast.error("Erro ao sincronizar: " + err.message);
      }
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle="Modelos aprovados pela Meta. São obrigatórios para iniciar uma conversa."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="sm:w-auto sm:px-4"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
              title="Carregar exemplos"
            >
              <Sparkles className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Carregar exemplos</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="sm:w-auto sm:px-4"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              title="Sincronizar"
            >
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <TemplateBuilderDialog
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Novo template
                </Button>
              }
            />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <InfoSection />

        <div className="flex border-b border-border bg-card/30 rounded-t-lg p-1 max-w-md">
          <button
            onClick={() => {
              setActiveTab("db");
              setSearch("");
            }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all duration-200",
              activeTab === "db"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            Meus Templates (DB Local)
          </button>
          <button
            onClick={() => {
              setActiveTab("meta");
              setSearch("");
            }}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all duration-200",
              activeTab === "meta"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            Direto da Meta (Tempo Real)
          </button>
        </div>

        {activeTab === "db" ? (
          (!isLoading && (data ?? []).length === 0) ? (
            <Card>
              <EmptyState
                icon={FileText}
                title="Nenhum template ainda"
                description="Sincronize seus templates aprovados pela Meta ou carregue exemplos para começar."
                action={
                  <div className="flex gap-2">
                    <TemplateBuilderDialog
                      trigger={
                        <Button>
                          <Plus className="mr-2 h-4 w-4" /> Criar template
                        </Button>
                      }
                    />
                    <Button
                      variant="outline"
                      onClick={() => seedMut.mutate()}
                      disabled={seedMut.isPending}
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Exemplos
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => syncMut.mutate()}
                      disabled={syncMut.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  className="max-w-sm"
                  placeholder="Buscar template por nome, status ou categoria…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  value={categoryFilter ?? "all"}
                  onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Utility">Utility</SelectItem>
                    <SelectItem value="Authentication">Authentication</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter ?? "all"}
                  onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="APPROVED">Aprovado</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="REJECTED">Rejeitado</SelectItem>
                    <SelectItem value="PAUSED">Pausado</SelectItem>
                    <SelectItem value="DISABLED">Desativado</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground font-medium">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  Selecionar todos ({filtered.length})
                </label>
                {someSelected && (
                  <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
                    <span className="font-medium">{selected.size} selecionado(s)</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={bulkDelete}
                      disabled={bulkMut.isPending}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {isLoading && <CardGridSkeleton count={6} />}

              {!isLoading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((t: any) => {
                    const isChecked = selected.has(t.id);
                    return (
                      <Card
                        key={t.id}
                        className={cn(
                          "flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
                          isChecked ? "ring-2 ring-primary" : "",
                        )}
                      >
                        <div className="border-b p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isChecked && (
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggle(t.id)}
                                  aria-label={`Selecionar ${t.name}`}
                                />
                              )}
                              <p className="font-medium truncate">{t.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[t.status] ?? "bg-muted"}`}
                              >
                                {statusLabels[t.status] ?? t.status}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 ml-1">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => toggle(t.id)}>
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                    {isChecked ? "Desmarcar template" : "Marcar template"}
                                  </DropdownMenuItem>
                                  <TemplateDetailsDialog
                                    templateId={t.id}
                                    trigger={
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Eye className="mr-2 h-4 w-4" /> Detalhes Meta
                                      </DropdownMenuItem>
                                    }
                                  />
                                  <TemplateBuilderDialog
                                    template={t}
                                    trigger={
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Pencil className="mr-2 h-4 w-4" /> Editar
                                      </DropdownMenuItem>
                                    }
                                  />
                                  <DropdownMenuItem
                                    onClick={() => singleDelete(t)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground font-medium">
                            {t.language} · {t.category ?? "—"}
                          </p>
                        </div>
                        <div className="p-4 flex-1">
                          <WhatsAppPreview components={t.components ?? []} />
                        </div>
                        {t.meta_template_id &&
                          (t.meta_template_id.startsWith("sample_") ||
                            t.meta_template_id.startsWith("local_")) && (
                            <div className="border-t bg-muted/20 px-4 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                                onClick={() => submitMut.mutate(t.id)}
                                disabled={submitMut.isPending}
                              >
                                <Send className="h-3 w-3" />
                                Enviar para aprovação na Meta
                              </Button>
                            </div>
                          )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="max-w-sm"
                placeholder="Filtrar nesta página por nome, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={categoryFilter ?? "all"}
                onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utility">Utility</SelectItem>
                  <SelectItem value="Authentication">Authentication</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter ?? "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="APPROVED">Aprovado</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="REJECTED">Rejeitado</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                  <SelectItem value="DISABLED">Desativado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingMeta && <CardGridSkeleton count={6} />}

            {metaError && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                <strong>Erro ao consultar Meta API:</strong> {(metaError as any).message}
              </div>
            )}

            {!isLoadingMeta && !metaError && (metaData?.data ?? []).length === 0 && (
              <Card>
                <EmptyState
                  icon={FileText}
                  title="Nenhum template na Meta"
                  description="Não encontramos nenhum template criado diretamente nesta conta do WhatsApp Business na Meta."
                  action={
                    <TemplateBuilderDialog
                      trigger={
                        <Button>
                          <Plus className="mr-2 h-4 w-4" /> Criar Novo Template
                        </Button>
                      }
                    />
                  }
                />
              </Card>
            )}

            {!isLoadingMeta && !metaError && (metaData?.data ?? []).length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredMeta.map((t: any) => {
                    return (
                      <Card
                        key={t.id}
                        className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 animate-in fade-in-50 duration-200"
                      >
                        <div className="border-b p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate min-w-0" title={t.name}>{t.name}</p>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusColors[t.status] ?? "bg-muted"}`}
                              >
                                {statusLabels[t.status] ?? t.status}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7">
                                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <TemplateDetailsDialog
                                    metaTemplateId={t.id}
                                    trigger={
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Eye className="mr-2 h-4 w-4" /> Detalhes Meta
                                      </DropdownMenuItem>
                                    }
                                  />
                                  <DropdownMenuItem
                                    onClick={() => deleteFromMetaDirect(t)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir na Meta
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                            {t.language} · {t.category ?? "—"}
                          </p>
                        </div>
                        <div className="p-4 flex-1">
                          <WhatsAppPreview components={t.components ?? []} />
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {metaData?.paging && (
                  <div className="flex items-center justify-between pt-4 border-t mt-4 bg-muted/10 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">
                      Página de resultados em tempo real.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCursorBefore(metaData.paging.cursors?.before);
                          setCursorAfter(undefined);
                        }}
                        disabled={!metaData.paging.previous}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCursorAfter(metaData.paging.cursors?.after);
                          setCursorBefore(undefined);
                        }}
                        disabled={!metaData.paging.next}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTemplateItem} onOpenChange={(open) => { if (!open) setDeleteTemplateItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>Excluir Template na Meta</span>
            </DialogTitle>
            <DialogDescription>
              Escolha como deseja excluir o template <strong>{deleteTemplateItem?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 hover:bg-muted/10">
              <input
                type="radio"
                name="delete-mode"
                checked={deleteMode === "single"}
                onChange={() => setDeleteMode("single")}
                className="mt-1 accent-primary"
              />
              <div className="grid gap-0.5 leading-none">
                <span className="text-sm font-semibold">Excluir apenas o idioma atual ({deleteTemplateItem?.language})</span>
                <span className="text-xs text-muted-foreground">
                  Apenas este idioma e ID serão removidos. Outras traduções do mesmo template continuarão ativas na Meta.
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 hover:bg-muted/10">
              <input
                type="radio"
                name="delete-mode"
                checked={deleteMode === "all"}
                onChange={() => setDeleteMode("all")}
                className="mt-1 accent-primary"
              />
              <div className="grid gap-0.5 leading-none">
                <span className="text-sm font-semibold">Excluir todas as variações (Por Nome)</span>
                <span className="text-xs text-muted-foreground">
                  Remove todas as variações de idioma associadas a este nome na Meta e no DB local.
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTemplateItem(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTemplateItem) return;
                try {
                  await remove({ data: { id: deleteTemplateItem.id, deleteMode } });
                  toast.success("Template excluído com sucesso");
                  setDeleteTemplateItem(null);
                  qc.invalidateQueries({ queryKey: ["templates"] });
                  qc.invalidateQueries({ queryKey: ["templates", "all"] });
                } catch (err: any) {
                  toast.error(err.message ?? "Erro ao excluir template");
                }
              }}
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoSection() {
  const categories = [
    {
      icon: Megaphone,
      name: "Marketing",
      desc: "Promoções, ofertas, novidades, convites e atualizações da marca.",
      price: "~R$ 0,20 – 0,40",
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: Bell,
      name: "Utility",
      desc: "Confirmações, atualizações de conta, lembretes e notificações transacionais.",
      price: "~R$ 0,08 – 0,15",
      tone: "bg-warning/15 text-warning-foreground",
    },
    {
      icon: ShieldCheck,
      name: "Authentication",
      desc: "Códigos de verificação (OTP) para login, cadastro e recuperação de conta.",
      price: "~R$ 0,03 – 0,06",
      tone: "bg-success/15 text-success",
    },
  ];

  const tips = [
    {
      title: "Janela de 24h (grátis)",
      desc: "Mensagens dentro de 24h após o cliente iniciar o contato não são cobradas.",
    },
    {
      title: "Use Utility no lugar de Marketing",
      desc: "Economize até 70% reclassificando notificações transacionais corretamente.",
    },
    {
      title: "Prefira Authentication para OTP",
      desc: "É a categoria mais barata — apenas código + botão de copiar.",
    },
    {
      title: "Incentive o cliente a iniciar",
      desc: "QR codes, links wa.me e chatbots no site abrem janelas gratuitas de 24h.",
    },
  ];

  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 border-b bg-muted/40 p-4 text-left transition hover:bg-muted/60"
      >
        <Info className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold">Informações sobre templates</h2>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Categorias oferecidas pela Meta</h3>
            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-start gap-3 rounded-lg border bg-card/50 p-3"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${c.tone}`}
                  >
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {c.price}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-success" /> Formas mais baratas de enviar
            </h3>
            <ul className="space-y-2">
              {tips.map((t) => (
                <li key={t.title} className="rounded-lg border bg-card/50 p-3">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              * Valores aproximados para o Brasil. Podem variar conforme o BSP e atualizações da
              Meta.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
