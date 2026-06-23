import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { createCampaign, updateCampaign } from "@/lib/campaigns.functions";
import { listLists, getListContacts } from "@/lib/lists.functions";
import { listTemplates } from "@/lib/templates.functions";
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
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";

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

export function CampaignWizard({
  onDone,
  initialCampaign,
}: {
  onDone: () => void;
  initialCampaign?: any | null;
}) {
  const create = useServerFn(createCampaign);
  const update = useServerFn(updateCampaign);
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

  useEffect(() => {
    setParamValues((prev) => {
      if (prev.length === templatePlaceholders.length) return prev;
      return Array.from({ length: templatePlaceholders.length }, (_, i) => prev[i] ?? "");
    });
  }, [templatePlaceholders]);

  useEffect(() => {
    if (!initialCampaign) {
      setStep(1);
      setName("");
      setListId("");
      setMessageType("template");
      setTemplateId("");
      setParamValues([]);
      setText("");
      setMediaType("image");
      setMediaUrl("");
      setCaption("");
      setStartNow(true);
      setScheduledAt("");
      return;
    }

    setStep(1);
    setName(initialCampaign.name ?? "");
    setListId(initialCampaign.list_id ?? "");
    setMessageType(initialCampaign.message_type ?? "template");
    setTemplateId(initialCampaign.template_id ?? "");
    setParamValues(
      Array.isArray(initialCampaign.payload?.variables) ? initialCampaign.payload.variables : [],
    );
    setText(initialCampaign.payload?.text ?? "");
    setMediaType(initialCampaign.payload?.media_type ?? "image");
    setMediaUrl(initialCampaign.payload?.media_url ?? "");
    setCaption(initialCampaign.payload?.caption ?? "");
    setStartNow(initialCampaign.status !== "draft");
    setScheduledAt(
      initialCampaign.scheduled_at
        ? new Date(initialCampaign.scheduled_at).toISOString().slice(0, 16)
        : "",
    );
  }, [initialCampaign]);

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

      const request = {
        name,
        message_type: messageType,
        template_id: messageType === "template" ? templateId || null : null,
        list_id: listId,
        payload,
        start_now: startNow,
        scheduled_at: !startNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      } as any;

      if (initialCampaign?.id) {
        return update({
          data: {
            id: initialCampaign.id,
            ...request,
          },
        });
      }

      return create({ data: request });
    },
    onSuccess: (r) => {
      toast.success(
        initialCampaign?.id
          ? `Campanha atualizada — ${r.queued} mensagens na fila`
          : `Campanha criada — ${r.queued} mensagens na fila`,
      );
      onDone();
    },
    onError: (e: any) =>
      toast.error(
        e.message ?? (initialCampaign?.id ? "Erro ao atualizar campanha" : "Erro ao criar campanha"),
      ),
  });

  return (
    <div>
      <DialogHeader>
        <DialogTitle>
          {initialCampaign?.id ? "Editar campanha" : "Nova campanha"} — passo {step} de 3
        </DialogTitle>
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
                  <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                          placeholder="Digite o texto ou insira variáveis da lista"
                          className="text-xs"
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {availableFields.map((field) => (
                            <Button
                              key={field}
                              type="button"
                              variant="outline"
                              className="h-6 rounded border-dashed bg-background px-2 py-0 text-[10px] text-muted-foreground hover:bg-muted"
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
                      className="h-6 rounded border-dashed bg-background px-2 py-0 text-[10px] text-muted-foreground hover:bg-muted"
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
                        className="h-6 rounded border-dashed bg-background px-2 py-0 text-[10px] text-muted-foreground hover:bg-muted"
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
                <span className="text-muted-foreground">Lista:</span> {selectedList?.name} ({listCount} contatos)
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
                <div className="break-all text-xs">
                  {mediaType}: {mediaUrl}
                </div>
              )}
            </Card>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={startNow} onChange={() => setStartNow(true)} /> Iniciar agora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!startNow} onChange={() => setStartNow(false)} /> Agendar
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
