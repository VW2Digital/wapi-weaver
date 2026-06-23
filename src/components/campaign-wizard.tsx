import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createCampaign, updateCampaign } from "@/lib/campaigns.functions";
import { listLists, getListContacts } from "@/lib/lists.functions";
import { listTemplates } from "@/lib/templates.functions";
import { getProfile } from "@/lib/profile.functions";
import { uploadMetaMediaViaApi } from "@/lib/meta-media-upload";
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
import { ChevronLeft, ChevronRight, Send, Loader2, Upload, Paperclip, Info } from "lucide-react";

function extractTemplatePlaceholders(components: any[] = []) {
  const placeholders: { key: string; label: string; token: string }[] = [];

  components.forEach((component: any) => {
    if (component?.type === "HEADER" && component.format === "TEXT") {
      const matches = String(component.text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
      matches.forEach((m) => {
        const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
        if (token && !placeholders.some(p => p.key === `header_${token}`)) {
          placeholders.push({
            key: `header_${token}`,
            label: `Cabeçalho: Parâmetro {{${token}}}`,
            token,
          });
        }
      });
    }

    if (component?.type === "BODY") {
      const matches = String(component.text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
      matches.forEach((m) => {
        const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
        if (token && !placeholders.some(p => p.key === token)) {
          placeholders.push({
            key: token,
            label: `Corpo: Parâmetro {{${token}}}`,
            token,
          });
        }
      });
    }

    if (component?.type === "BUTTONS" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button: any, btnIndex: number) => {
        if (button?.type === "URL") {
          const matches = String(button.url ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
          matches.forEach((m) => {
            const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
            const key = `button_${btnIndex}_${token}`;
            if (token && !placeholders.some(p => p.key === key)) {
              placeholders.push({
                key,
                label: `Botão "${button.text}": Link dinâmico {{${token}}}`,
                token,
              });
            }
          });
        }
      });
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

  const fetchProfile = useServerFn(getProfile);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const profile = profileQuery.data;

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [headerMediaSource, setHeaderMediaSource] = useState<"upload" | "url" | "id">("upload");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerMediaId, setHeaderMediaId] = useState("");
  const [headerDocumentFilename, setHeaderDocumentFilename] = useState("");
  const [uploadingHeaderMedia, setUploadingHeaderMedia] = useState(false);

  const selectedTemplate = (templates.data ?? []).find((t: any) => t.id === templateId);
  const selectedList = (lists.data ?? []).find((l: any) => l.id === listId);
  const listCount = selectedList?.list_contacts?.[0]?.count ?? 0;

  const headerComponent = selectedTemplate?.components?.find((c: any) => c.type === "HEADER");
  const headerMediaFormat = headerComponent && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComponent.format)
    ? headerComponent.format as "IMAGE" | "VIDEO" | "DOCUMENT"
    : null;

  const handleHeaderFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !headerMediaFormat) return;

    const phoneId = profile?.whatsapp_phone_number_id;
    if (!phoneId) {
      toast.error("ID do número de telefone não configurado. Vá em Configurações.");
      return;
    }

    setUploadingHeaderMedia(true);
    const toastId = toast.loading(`Enviando ${headerMediaFormat.toLowerCase()} para a Meta...`);

    try {
      const res = await uploadMetaMediaViaApi(phoneId, file);

      if (!res.ok || !res.data?.id) {
        throw new Error(res.error || "Falha no upload de mídia na Meta.");
      }

      setHeaderMediaId(res.data.id);
      toast.success("Mídia enviada e configurada com sucesso!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Erro no envio de mídia.", { id: toastId });
    } finally {
      setUploadingHeaderMedia(false);
    }
  };

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
      setHeaderMediaSource("upload");
      setHeaderMediaUrl("");
      setHeaderMediaId("");
      setHeaderDocumentFilename("");
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

    const p = initialCampaign.payload ?? {};
    const mediaId = p.header_media_id || p.header_image_id || p.header_video_id || p.header_document_id || "";
    const mUrl = p.header_media_link || p.header_image_url || p.header_video_url || p.header_document_url || "";
    setHeaderMediaId(mediaId);
    setHeaderMediaUrl(mUrl);
    setHeaderDocumentFilename(p.header_document_filename ?? "");
    setHeaderMediaSource(mediaId ? "id" : mUrl ? "url" : "upload");
  }, [initialCampaign]);

  const mut = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (messageType === "template") {
        if (!selectedTemplate) throw new Error("Selecione um template");
        payload.template_name = selectedTemplate.name;
        payload.language = selectedTemplate.language;
        payload.template_components = selectedTemplate.components ?? [];
        payload.template_placeholders = templatePlaceholders.map((p) => p.key);
        if (selectedTemplate.parameter_format) payload.parameter_format = selectedTemplate.parameter_format;
        const vars = paramValues.map((v) => v.trim());
        if (vars.length) payload.variables = vars;

        const headerComponent = selectedTemplate?.components?.find((c: any) => c.type === "HEADER");
        if (headerComponent && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComponent.format)) {
          if (headerMediaId) {
            payload.header_media_id = headerMediaId;
            if (headerComponent.format === "IMAGE") payload.header_image_id = headerMediaId;
            if (headerComponent.format === "VIDEO") payload.header_video_id = headerMediaId;
            if (headerComponent.format === "DOCUMENT") payload.header_document_id = headerMediaId;
          }
          if (headerMediaUrl) {
            payload.header_media_link = headerMediaUrl;
            if (headerComponent.format === "IMAGE") payload.header_image_url = headerMediaUrl;
            if (headerComponent.format === "VIDEO") payload.header_video_url = headerMediaUrl;
            if (headerComponent.format === "DOCUMENT") payload.header_document_url = headerMediaUrl;
          }
          if (headerComponent.format === "DOCUMENT" && headerDocumentFilename) {
            payload.header_document_filename = headerDocumentFilename;
          }
        }
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
              <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">
                {/* Coluna Esquerda: Configurações e Variáveis */}
                <div className="space-y-4">
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

                  {selectedTemplate && (
                    (() => {
                      const templateButtons = selectedTemplate?.components?.find((c: any) => c.type === "BUTTONS")?.buttons ?? [];
                      const hasButtons = templateButtons.length > 0;
                      const hasDynamicButtons = templatePlaceholders.some(p => p.key.startsWith("button_"));
                      if (!hasButtons) return null;

                      return (
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-500 space-y-1">
                          <p className="font-semibold flex items-center gap-1.5">
                            <Info className="h-4 w-4 shrink-0" />
                            Informação sobre Botões do Template
                          </p>
                          <p className="text-muted-foreground leading-normal">
                            • <strong>Texto do Botão (CTA):</strong> É fixado conforme aprovado na Meta. Para alterá-lo, edite o template na seção <strong>Templates</strong>.
                          </p>
                          {!hasDynamicButtons ? (
                            <p className="text-muted-foreground leading-normal">
                              • <strong>Link do Botão:</strong> Este template possui links estáticos. Para enviar links dinâmicos e personalizáveis por envio, edite o template na aba <strong>Templates</strong> e configure a URL terminando com <code>{"{{1}}"}</code> (ex: <code>https://site.com/{"{{1}}"}</code>).
                            </p>
                          ) : (
                            <p className="text-muted-foreground leading-normal">
                              • <strong>Link do Botão:</strong> Este template possui links dinâmicos. Preencha o campo de link dinâmico abaixo para definir a parte personalizada do link (ex: código do cupom ou ID do cliente).
                            </p>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {headerMediaFormat && (
                    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                          Mídia do Cabeçalho ({headerMediaFormat === "IMAGE" ? "Imagem" : headerMediaFormat === "VIDEO" ? "Vídeo" : "Documento"})
                        </Label>
                        <div className="flex rounded-md bg-muted p-1 gap-1">
                          {(["upload", "url", "id"] as const).map((source) => (
                            <Button
                              key={source}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={`flex-1 text-xs py-1.5 h-auto ${
                                headerMediaSource === source
                                  ? "bg-background shadow-sm text-foreground"
                                  : "text-muted-foreground hover:bg-background/50"
                              }`}
                              onClick={() => setHeaderMediaSource(source)}
                            >
                              {source === "upload"
                                ? "Upload de arquivo"
                                : source === "url"
                                ? "URL pública"
                                : "ID da Meta"}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {headerMediaSource === "upload" && (
                        <div className="space-y-3">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleHeaderFileChange}
                            accept={
                              headerMediaFormat === "IMAGE"
                                ? "image/*"
                                : headerMediaFormat === "VIDEO"
                                ? "video/*"
                                : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                            }
                            className="hidden"
                          />
                          <div
                            className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {uploadingHeaderMedia ? (
                              <div className="flex flex-col items-center space-y-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Enviando arquivo para a Meta...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center space-y-2">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Clique para fazer upload</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {headerMediaFormat === "IMAGE"
                                    ? "Imagens até 5MB"
                                    : headerMediaFormat === "VIDEO"
                                    ? "Vídeos até 16MB"
                                    : "Documentos até 100MB"}
                                </span>
                              </div>
                            )}
                          </div>
                          {headerMediaId && (
                            <div className="flex items-center gap-2 rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs text-emerald-500">
                              <span className="font-semibold">✓</span>
                              <span className="truncate">
                                Arquivo enviado. ID da Meta:{" "}
                                <code className="bg-emerald-500/10 px-1 py-0.5 rounded font-mono">{headerMediaId}</code>
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {headerMediaSource === "url" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">URL pública da mídia (HTTPS)</Label>
                          <Input
                            value={headerMediaUrl}
                            onChange={(e) => {
                              setHeaderMediaUrl(e.target.value);
                              setHeaderMediaId("");
                            }}
                            placeholder="https://sua-empresa.com.br/assets/banner.png"
                            className="text-xs"
                          />
                        </div>
                      )}

                      {headerMediaSource === "id" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">ID do objeto de mídia na Meta</Label>
                          <Input
                            value={headerMediaId}
                            onChange={(e) => {
                              setHeaderMediaId(e.target.value);
                              setHeaderMediaUrl("");
                            }}
                            placeholder="Ex: 92837498237498237"
                            className="text-xs font-mono"
                          />
                        </div>
                      )}

                      {headerMediaFormat === "DOCUMENT" && (
                        <div className="space-y-1.5 pt-2 border-t border-muted">
                          <Label className="text-xs">Nome do arquivo do documento (exibido no chat)</Label>
                          <Input
                            value={headerDocumentFilename}
                            onChange={(e) => setHeaderDocumentFilename(e.target.value)}
                            placeholder="catalogo_produtos.pdf"
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {templatePlaceholders.length > 0 && (
                    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Variáveis do Template
                      </p>
                      {templatePlaceholders.map((placeholder, i) => (
                        <div key={i} className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {placeholder.label}
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
                </div>

                {/* Coluna Direita: Pré-visualização */}
                <div className="md:sticky md:top-4 space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Pré-visualização
                  </Label>
                  {selectedTemplate ? (
                    <WhatsAppPreview
                      components={(selectedTemplate.components ?? []) as any}
                      headerMediaUrl={headerMediaUrl || undefined}
                      variables={Object.fromEntries(
                        paramValues
                          .map((v, i) => [templatePlaceholders[i]?.token, v.trim()])
                          .filter(([key, value]) => key && value),
                      )}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground bg-muted/10">
                      Selecione um template para ver a pré-visualização.
                    </div>
                  )}
                </div>
              </div>
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
              (step === 2 && (
                (messageType === "template" && (
                  !templateId || (headerMediaFormat !== null && !headerMediaId && !headerMediaUrl)
                )) ||
                (messageType === "media" && !mediaUrl)
              ))
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
