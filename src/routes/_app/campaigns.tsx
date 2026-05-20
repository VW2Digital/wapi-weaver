import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listCampaigns, createCampaign, cancelCampaign } from "@/lib/campaigns.functions";
import { listLists } from "@/lib/lists.functions";
import { listTemplates } from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Send, XCircle, ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_app/campaigns")({ component: CampaignsPage });

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
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchAll() });

  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Crie disparos em massa para suas listas de contatos."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova campanha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CampaignWizard onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["campaigns"] }); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6">
        <Card>
          {isLoading && <p className="p-6 text-muted-foreground">Carregando…</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma campanha ainda. Clique em <strong>Nova campanha</strong> para começar.
            </p>
          )}
          <div className="divide-y">
            {(data ?? []).map((c: any) => {
              const t = (c.totals ?? {}) as Record<string, number>;
              const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
              return (
                <div key={c.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30">
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="truncate font-medium">{c.name}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.message_type} · {new Date(c.created_at).toLocaleString("pt-BR")} ·
                      {" "}{t.sent ?? 0}/{t.total ?? 0} enviadas · {t.delivered ?? 0} entregues · {t.read ?? 0} lidas · {t.failed ?? 0} falharam
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {(c.status === "queued" || c.status === "running") && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await cancel({ data: { id: c.id } });
                        toast.success("Campanha cancelada");
                        qc.invalidateQueries({ queryKey: ["campaigns"] });
                      }}>
                        <XCircle className="mr-1 h-4 w-4" /> Cancelar
                      </Button>
                    )}
                    <Link to="/campaigns/$id" params={{ id: c.id }}>
                      <Button size="sm" variant="outline">Detalhes <ChevronRight className="ml-1 h-4 w-4" /></Button>
                    </Link>
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
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => fetchLists() });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => fetchTemplates() });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [listId, setListId] = useState<string>("");
  const [messageType, setMessageType] = useState<"template" | "text" | "media">("template");
  const [templateId, setTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<string>(""); // comma-separated
  const [text, setText] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "document" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const selectedTemplate = (templates.data ?? []).find((t: any) => t.id === templateId);
  const selectedList = (lists.data ?? []).find((l: any) => l.id === listId);
  const listCount = selectedList?.list_contacts?.[0]?.count ?? 0;

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (messageType === "template") {
        if (!selectedTemplate) throw new Error("Selecione um template");
        payload.template_name = selectedTemplate.name;
        payload.language = selectedTemplate.language;
        const vars = variables.split(",").map((v) => v.trim()).filter(Boolean);
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
          template_id: messageType === "template" ? (templateId || null) : null,
          list_id: listId,
          payload,
          start_now: startNow,
          scheduled_at: !startNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        } as any,
      });
    },
    onSuccess: (r) => { toast.success(`Campanha criada — ${r.queued} mensagens na fila`); onDone(); },
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Black Friday" />
            </div>
            <div>
              <Label>Lista de contatos</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                <SelectContent>
                  {(lists.data ?? []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.list_contacts?.[0]?.count ?? 0} contatos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedList && (
                <p className="mt-1 text-xs text-muted-foreground">{listCount} contatos serão atingidos.</p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label>Tipo de mensagem</Label>
              <Select value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Selecione um template aprovado" /></SelectTrigger>
                    <SelectContent>
                      {(templates.data ?? []).filter((t: any) => t.status === "APPROVED").map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.language})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Variáveis do corpo (separadas por vírgula)</Label>
                  <Input
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    placeholder="ex: {{name}}, R$ 99,90"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use <code>{`{{name}}`}</code> ou <code>{`{{campo_custom}}`}</code> para interpolar dados do contato.
                  </p>
                </div>
              </>
            )}

            {messageType === "text" && (
              <div>
                <Label>Texto</Label>
                <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Olá {{name}}, ..." />
              </div>
            )}

            {messageType === "media" && (
              <>
                <div>
                  <Label>Tipo</Label>
                  <Select value={mediaType} onValueChange={(v) => setMediaType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="document">Documento (PDF)</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL da mídia (pública, HTTPS)</Label>
                  <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Legenda (opcional)</Label>
                  <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Card className="space-y-2 p-4 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> <strong>{name}</strong></div>
              <div><span className="text-muted-foreground">Lista:</span> {selectedList?.name} ({listCount} contatos)</div>
              <div><span className="text-muted-foreground">Tipo:</span> {messageType}</div>
              {messageType === "template" && <div><span className="text-muted-foreground">Template:</span> {selectedTemplate?.name}</div>}
              {messageType === "text" && <div className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{text}</div>}
              {messageType === "media" && <div className="text-xs break-all">{mediaType}: {mediaUrl}</div>}
            </Card>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={startNow} onChange={() => setStartNow(true)} /> Iniciar agora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!startNow} onChange={() => setStartNow(false)} /> Agendar
              </label>
              {!startNow && (
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
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
            disabled={(step === 1 && (!name || !listId)) || (step === 2 && messageType === "template" && !templateId)}
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
