import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  listCampaigns,
  createCampaign,
  cancelCampaign,
  deleteCampaign,
} from "@/lib/campaigns.functions";
import { listLists, getListContacts } from "@/lib/lists.functions";
import { listTemplates } from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  Plus,
  Send,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Megaphone,
  Trash2,
  MoreVertical,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { useConfirm } from "@/components/confirm-dialog";
import { ListSkeleton } from "@/components/table-skeleton";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/campaigns/")({ component: CampaignsPage });

function extractTemplatePlaceholders(components: any[] = []) {
  const placeholders: string[] = [];
  const pushFromText = (text?: string) => {
    const matches = String(text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
    for (const match of matches) {
      const token = match.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
      if (token && !placeholders.includes(token)) placeholders.push(token);
    }
  };

  components.forEach((component: any) => {
    if (component?.text) pushFromText(component.text);
    if (component?.type === "BUTTONS" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button: any) => pushFromText(button?.url));
    }
  });

  return placeholders;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  queued: { label: "Na fila", cls: "bg-warning/15 text-warning-foreground" },
  running: { label: "Enviando", cls: "bg-primary/15 text-primary" },
  done: { label: "Concluída", cls: "bg-success/15 text-success" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

function CampaignsPage() {
  const fetchAll = useServerFn(listCampaigns);
  const cancel = useServerFn(cancelCampaign);
  const remove = useServerFn(deleteCampaign);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchAll() });
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);

  const filtered = (data ?? []).filter(
    (c: any) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.status.includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Campanhas"
        subtitle="Crie disparos em massa para suas listas de contatos."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CampaignWizard
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["campaigns"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {(data ?? []).length > 0 && (
          <Input
            className="max-w-sm"
            placeholder="Buscar campanha por nome ou status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <Card>
          {isLoading && <ListSkeleton rows={4} />}
          {!isLoading && (data ?? []).length === 0 && (
            <EmptyState
              icon={Megaphone}
              title="Nenhuma campanha ainda"
              description="Crie sua primeira campanha para disparar mensagens em massa para uma lista de contatos."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nova campanha
                </Button>
              }
            />
          )}
          {!isLoading && (data ?? []).length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={Megaphone}
              title="Nenhuma campanha encontrada"
              description="Tente uma busca diferente."
            />
          )}
          <div className="divide-y">
            {filtered.map((c: any) => {
              const t = (c.totals ?? {}) as Record<string, number>;
              const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30"
                >
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="truncate font-medium">{c.name}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                      {c.template_diagnostic?.status === "invalid" && (
                        <Badge variant="destructive">Template inválido</Badge>
                      )}
                      {c.template_diagnostic?.status === "legacy_unlinked" && (
                        <Badge variant="outline">Campanha antiga</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.message_type} · {new Date(c.created_at).toLocaleString("pt-BR")} ·{" "}
                      {t.sent ?? 0}/{t.total ?? 0} enviadas · {t.delivered ?? 0} entregues ·{" "}
                      {t.read ?? 0} lidas · {t.failed ?? 0} falharam
                    </p>
                    {c.template_diagnostic?.status === "invalid" && (
                      <p className="mt-1 text-xs text-destructive">
                        {c.template_diagnostic.message}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/campaigns/$id"
                            params={{ id: c.id }}
                            className="flex w-full items-center cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            Detalhes
                          </Link>
                        </DropdownMenuItem>

                        {(c.status === "queued" || c.status === "running") && (
                          <DropdownMenuItem
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Cancelar campanha?",
                                description: (
                                  <>
                                    Mensagens pendentes da campanha <strong>{c.name}</strong> não
                                    serão enviadas.
                                  </>
                                ),
                                destructive: true,
                                confirmText: "Cancelar campanha",
                                cancelText: "Voltar",
                              });
                              if (!ok) return;
                              await cancel({ data: { id: c.id } });
                              toast.success("Campanha cancelada");
                              qc.invalidateQueries({ queryKey: ["campaigns"] });
                            }}
                            className="text-warning focus:text-warning cursor-pointer"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Excluir campanha?",
                              description: (
                                <>
                                  A campanha <strong>{c.name}</strong> e todas as mensagens
                                  associadas serão removidas permanentemente.
                                </>
                              ),
                              destructive: true,
                              confirmText: "Excluir",
                              cancelText: "Cancelar",
                            });
                            if (!ok) return;
                            await remove({ data: { id: c.id } });
                            toast.success("Campanha excluída");
                            qc.invalidateQueries({ queryKey: ["campaigns"] });
                          }}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CampaignWizard({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createCampaign);
  const fetchLists = useServerFn(listLists);
  const fetchTemplates = useServerFn(listTemplates);
  const fetchListContacts = useServerFn(getListContacts);
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => fetchLists() });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => fetchTemplates() });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [listId, setListId] = useState<string>("");
  const [messageType, setMessageType] = useState<"template" | "text" | "media">("template");
  const [templateId, setTemplateId] = useState<string>("");
  const [paramValues, setParamValues] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "document" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const selectedTemplate = (templates.data ?? []).find((t: any) => t.id === templateId);
  const selectedList = (lists.data ?? []).find((l: any) => l.id === listId);
  const listCount = selectedList?.list_contacts?.[0]?.count ?? 0;

  // Carrega contatos da lista selecionada para extrair os campos personalizados
  const { data: listContactsData } = useQuery({
    queryKey: ["list-contacts", listId],
    queryFn: () => fetchListContacts({ data: { list_id: listId } }),
    enabled: !!listId,
  });

  const availableFields = useMemo(() => {
    const fields = new Set<string>(["nome", "email", "telefone"]);
    if (listContactsData) {
      listContactsData.forEach((row: any) => {
        const custom = row.contacts?.custom_fields;
        if (custom && typeof custom === "object") {
          Object.keys(custom).forEach((k) => {
            const trimmed = k.trim();
            if (trimmed) fields.add(trimmed);
          });
        }
      });
    }
    return Array.from(fields);
  }, [listContactsData]);

  const templatePlaceholders = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractTemplatePlaceholders(selectedTemplate.components ?? []);
  }, [selectedTemplate]);

  // Sincroniza a quantidade de inputs com o template selecionado
  useEffect(() => {
    setParamValues(Array(templatePlaceholders.length).fill(""));
  }, [templatePlaceholders]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (messageType === "template") {
        if (!selectedTemplate) throw new Error("Selecione um template");
        payload.template_name = selectedTemplate.name;
        payload.language = selectedTemplate.language;
        payload.template_components = selectedTemplate.components ?? [];
        payload.template_placeholders = templatePlaceholders;
        if (selectedTemplate.parameter_format) payload.parameter_format = selectedTemplate.parameter_format;
        const vars = paramValues.map((v) => v.trim());
        if (vars.length) payload.variables = vars;
      } else if (messageType === "text") {
        if (!text.trim()) throw new Error("Texto obrigatório");
        payload.text = text;
      } else {
        if (!mediaUrl) throw new Error("URL da mídia obrigatória");
        payload.media_type = mediaType;
        payload.media_url = mediaUrl;
        if (caption) payload.caption = caption;
      }
      return create({
        data: {
          name,
          message_type: messageType,
          template_id: messageType === "template" ? templateId || null : null,
          list_id: listId,
          payload,
          start_now: startNow,
          scheduled_at: !startNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        } as any,
      });
    },
    onSuccess: (r) => {
      toast.success(`Campanha criada — ${r.queued} mensagens na fila`);
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar campanha"),
  });

  return (
    <div>
      <DialogHeader>
        <DialogTitle>Nova campanha — passo {step} de 3</DialogTitle>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        {step === 1 && (
          <>
            <div>
              <Label>Nome da campanha</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Promo Black Friday"
              />
            </div>
            <div>
              <Label>Lista de contatos</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {(lists.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.list_contacts?.[0]?.count ?? 0} contatos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedList && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {listCount} contatos serão atingidos.
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label>Tipo de mensagem</Label>
              <Select value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template aprovado (HSM)</SelectItem>
                  <SelectItem value="text">Texto livre (apenas janela 24h)</SelectItem>
                  <SelectItem value="media">Mídia (imagem, PDF, vídeo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType === "template" && (
              <>
                <div>
                  <Label>Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template aprovado" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templates.data ?? [])
                        .filter((t: any) => t.status === "APPROVED")
                        .map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {templatePlaceholders.length > 0 && (
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Variáveis do Template
                    </p>
                    {templatePlaceholders.map((placeholder, i) => (
                      <div key={i} className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          Parâmetro {`{{${placeholder}}}`}
                        </Label>
                        <Input
                          value={paramValues[i] ?? ""}
                          onChange={(e) => {
                            const next = [...paramValues];
                            next[i] = e.target.value;
                            setParamValues(next);
                          }}
                          placeholder={`Digite o texto ou insira variáveis da lista`}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                          {availableFields.map((field) => (
                            <Button
                              key={field}
                              type="button"
                              variant="outline"
                              className="h-6 px-2 py-0 text-[10px] rounded bg-background hover:bg-muted text-muted-foreground border-dashed"
                              onClick={() => {
                                const next = [...paramValues];
                                const current = next[i] ?? "";
                                next[i] = current ? `${current} {{${field}}}` : `{{${field}}}`;
                                setParamValues(next);
                              }}
                            >
                              +{field}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTemplate && (
                  <div>
                    <Label className="mb-2 block">Pré-visualização</Label>
                    <WhatsAppPreview
                      components={(selectedTemplate.components ?? []) as any}
                      variables={Object.fromEntries(
                        paramValues
                          .map((v, i) => [templatePlaceholders[i], v.trim()])
                          .filter(([key, value]) => key && value),
                      )}
                    />
                  </div>
                )}
              </>
            )}

            {messageType === "text" && (
              <div className="space-y-1.5">
                <Label>Texto</Label>
                <Textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Olá {{nome}}, ..."
                />
                <p className="text-xs text-muted-foreground">
                  Clique nas tags abaixo para inseri-las no texto:
                </p>
                <div className="flex flex-wrap gap-1">
                  {availableFields.map((field) => (
                    <Button
                      key={field}
                      type="button"
                      variant="outline"
                      className="h-6 px-2 py-0 text-[10px] rounded bg-background hover:bg-muted text-muted-foreground border-dashed"
                      onClick={() => setText((t) => (t ? `${t} {{${field}}}` : `{{${field}}}`))}
                    >
                      +{field}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messageType === "media" && (
              <>
                <div>
                  <Label>Tipo</Label>
                  <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="document">Documento (PDF)</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL da mídia (pública, HTTPS)</Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Legenda (opcional)</Label>
                  <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Clique nas tags abaixo para inseri-las na legenda:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {availableFields.map((field) => (
                      <Button
                        key={field}
                        type="button"
                        variant="outline"
                        className="h-6 px-2 py-0 text-[10px] rounded bg-background hover:bg-muted text-muted-foreground border-dashed"
                        onClick={() =>
                          setCaption((c) => (c ? `${c} {{${field}}}` : `{{${field}}}`))
                        }
                      >
                        +{field}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Card className="space-y-2 p-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nome:</span> <strong>{name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Lista:</span> {selectedList?.name} (
                {listCount} contatos)
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span> {messageType}
              </div>
              {messageType === "template" && (
                <div>
                  <span className="text-muted-foreground">Template:</span> {selectedTemplate?.name}
                </div>
              )}
              {messageType === "text" && (
                <div className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{text}</div>
              )}
              {messageType === "media" && (
                <div className="text-xs break-all">
                  {mediaType}: {mediaUrl}
                </div>
              )}
            </Card>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={startNow} onChange={() => setStartNow(true)} /> Iniciar
                agora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!startNow} onChange={() => setStartNow(false)} />{" "}
                Agendar
              </label>
              {!startNow && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {step < 3 ? (
          <Button
            disabled={
              (step === 1 && (!name || !listId)) ||
              (step === 2 && messageType === "template" && !templateId)
            }
            onClick={() => setStep(step + 1)}
          >
            Próximo <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            <Send className="mr-2 h-4 w-4" /> {startNow ? "Disparar agora" : "Agendar"}
          </Button>
        )}
      </div>
    </div>
  );
}
