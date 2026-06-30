import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ExternalLink,
  Phone,
  Reply,
  Copy,
  ShoppingBag,
  LayoutGrid,
  Zap,
  KeyRound,
  PhoneCall,
  Settings,
  ChevronDown,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import {
  createTemplate,
  updateTemplate,
  type CreateTemplateInput,
} from "@/lib/templates.functions";

type HeaderState =
  | { format: "NONE" }
  | { format: "TEXT"; text: string }
  | { format: "IMAGE" | "VIDEO" | "DOCUMENT"; example_url: string }
  | { format: "LOCATION" };

type ButtonState =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; example: string[] }
  | { type: "CATALOG"; text: string }
  | { type: "MPM"; text: string }
  | {
      type: "FLOW";
      text: string;
      flow_id: string;
      flow_action: "navigate" | "data_exchange";
      navigate_screen?: string;
    }
  | {
      type: "OTP";
      otp_type: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
      text?: string;
      autofill_text?: string;
      package_name?: string;
      signature_hash?: string;
    }
  | { type: "VOICE_CALL"; text: string };

const LANGS = [
  { v: "pt_BR", l: "Português (BR)" },
  { v: "en_US", l: "English (US)" },
  { v: "es_ES", l: "Español (ES)" },
  { v: "es_MX", l: "Español (MX)" },
  { v: "fr_FR", l: "Français" },
  { v: "it_IT", l: "Italiano" },
  { v: "de_DE", l: "Deutsch" },
];

function extractVarCount(text: string) {
  const matches = text.match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
  const tokens: string[] = [];
  for (const match of matches) {
    const token = match.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}

export function TemplateBuilderDialog({
  trigger,
  template,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: ReactNode;
  template?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen || setInternalOpen;
  const submitCreate = useServerFn(createTemplate);
  const submitUpdate = useServerFn(updateTemplate);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");
  const [header, setHeader] = useState<HeaderState>({ format: "NONE" });
  const [body, setBody] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonState[]>([]);

  // Advanced configurations
  const [parameterFormat, setParameterFormat] = useState<"NAMED" | "POSITIONAL" | "default">(
    "default",
  );
  const [allowCategoryChange, setAllowCategoryChange] = useState<boolean>(true);
  const [ctaUrlLinkTrackingOptedOut, setCtaUrlLinkTrackingOptedOut] = useState<boolean>(false);
  const [messageSendTtlSeconds, setMessageSendTtlSeconds] = useState<string>("");
  const [subCategory, setSubCategory] = useState<string>("default");
  const [isPrimaryDeviceDeliveryOnly, setIsPrimaryDeviceDeliveryOnly] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (template && open) {
      setName(template.name || "");
      setLanguage(template.language || "pt_BR");
      setCategory(template.category || "MARKETING");

      // Load advanced configs
      setParameterFormat(template.parameter_format || "default");
      setAllowCategoryChange(template.allow_category_change !== 0);
      setCtaUrlLinkTrackingOptedOut(template.cta_url_link_tracking_opted_out === 1);
      setMessageSendTtlSeconds(
        template.message_send_ttl_seconds ? String(template.message_send_ttl_seconds) : "",
      );
      setSubCategory(template.sub_category || "default");
      setIsPrimaryDeviceDeliveryOnly(template.is_primary_device_delivery_only === 1);

      const comps = template.components || [];
      const headerComp = comps.find((c: any) => c.type === "HEADER");
      if (headerComp) {
        if (headerComp.format === "TEXT") {
          setHeader({ format: "TEXT", text: headerComp.text || "" });
        } else if (headerComp.format === "LOCATION") {
          setHeader({ format: "LOCATION" });
        } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
          setHeader({
            format: headerComp.format,
            example_url: headerComp.example?.header_handle?.[0] || "",
          });
        } else {
          setHeader({ format: "NONE" });
        }
      } else {
        setHeader({ format: "NONE" });
      }

      const bodyComp = comps.find((c: any) => c.type === "BODY");
      if (bodyComp) {
        setBody(bodyComp.text || "");
        const named = bodyComp.example?.body_text_named_params;
        if (named) {
          setBodyExamples(named.map((p: any) => p.example ?? ""));
        } else {
          setBodyExamples(bodyComp.example?.body_text?.[0] || []);
        }
      } else {
        setBody("");
        setBodyExamples([]);
      }

      const footerComp = comps.find((c: any) => c.type === "FOOTER");
      if (footerComp) {
        setFooter(footerComp.text || "");
      } else {
        setFooter("");
      }

      const buttonsComp = comps.find((c: any) => c.type === "BUTTONS");
      if (buttonsComp && buttonsComp.buttons) {
        setButtons(buttonsComp.buttons);
      } else {
        setButtons([]);
      }
    } else if (!template && open) {
      reset();
    }
  }, [template, open]);

  const bodyPlaceholders = extractVarCount(body);
  useEffect(() => {
    setBodyExamples((prev) => {
      if (prev.length === bodyPlaceholders.length) return prev;
      return Array.from({ length: bodyPlaceholders.length }, (_, i) => prev[i] ?? "");
    });
  }, [bodyPlaceholders]);

  const previewComponents: any[] = [];
  if (header.format === "TEXT") {
    previewComponents.push({ type: "HEADER", format: "TEXT", text: header.text });
  } else if (
    header.format === "IMAGE" ||
    header.format === "VIDEO" ||
    header.format === "DOCUMENT"
  ) {
    previewComponents.push({
      type: "HEADER",
      format: header.format,
      example: { header_handle: [header.example_url] },
    });
  } else if (header.format === "LOCATION") {
    previewComponents.push({ type: "HEADER", format: "LOCATION" });
  }
  if (body) previewComponents.push({ type: "BODY", text: body });
  if (footer) previewComponents.push({ type: "FOOTER", text: footer });
  if (buttons.length) previewComponents.push({ type: "BUTTONS", buttons });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: name.trim(),
        language,
        category,
        header:
          header.format === "NONE"
            ? { format: "NONE" }
            : header.format === "TEXT"
              ? { format: "TEXT", text: header.text }
              : header.format === "LOCATION"
                ? { format: "LOCATION" }
                : { format: header.format, example_url: header.example_url },
        body,
        body_examples: bodyExamples.filter((s) => s.length > 0),
        footer: footer || undefined,
        buttons: buttons.length ? (buttons as any) : undefined,
        // Advanced
        parameter_format: parameterFormat === "default" ? undefined : parameterFormat,
        allow_category_change: allowCategoryChange,
        cta_url_link_tracking_opted_out: ctaUrlLinkTrackingOptedOut,
        message_send_ttl_seconds: messageSendTtlSeconds
          ? parseInt(messageSendTtlSeconds, 10)
          : undefined,
        sub_category: category === "UTILITY" && subCategory !== "default" ? subCategory : undefined,
        is_primary_device_delivery_only: isPrimaryDeviceDeliveryOnly,
      };
      if (template?.id) {
        payload.id = template.id;
        return submitUpdate({ data: payload });
      } else {
        return submitCreate({ data: payload });
      }
    },
    onSuccess: () => {
      toast.success(
        template
          ? "Template atualizado com sucesso."
          : "Template criado. Aguarde a análise da Meta.",
      );
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["templates", "all"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar template"),
  });

  function reset() {
    setName("");
    setLanguage("pt_BR");
    setCategory("MARKETING");
    setHeader({ format: "NONE" });
    setBody("");
    setBodyExamples([]);
    setFooter("");
    setButtons([]);
    setParameterFormat("default");
    setAllowCategoryChange(true);
    setCtaUrlLinkTrackingOptedOut(false);
    setMessageSendTtlSeconds("");
    setSubCategory("default");
    setIsPrimaryDeviceDeliveryOnly(false);
    setShowAdvanced(false);
  }

  function addButton(type: ButtonState["type"]) {
    if (buttons.length >= 10) return;
    let nb: ButtonState;
    switch (type) {
      case "QUICK_REPLY":
        nb = { type, text: "" };
        break;
      case "URL":
        nb = { type, text: "", url: "https://" };
        break;
      case "PHONE_NUMBER":
        nb = { type, text: "", phone_number: "+55" };
        break;
      case "COPY_CODE":
        nb = { type, example: [""] };
        break;
      case "CATALOG":
        nb = { type, text: "Ver catálogo" };
        break;
      case "MPM":
        nb = { type, text: "Ver produtos" };
        break;
      case "FLOW":
        nb = { type, text: "", flow_id: "", flow_action: "navigate" };
        break;
      case "OTP":
        nb = { type, otp_type: "COPY_CODE", text: "Copiar código" };
        break;
      case "VOICE_CALL":
        nb = { type, text: "Ligar" };
        break;
    }
    setButtons([...buttons, nb!]);
  }

  function updateButton(i: number, patch: Partial<ButtonState>) {
    const next = [...buttons];
    next[i] = { ...(next[i] as any), ...(patch as any) };
    setButtons(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {/* Identificação */}
            <Card className="p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Nome interno</Label>
                  <Input
                    placeholder="ex: boas_vindas_clientes"
                    value={name}
                    disabled={!!template}
                    onChange={(e) =>
                      setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">minúsculas, números e _</p>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select value={language} onValueChange={setLanguage} disabled={!!template}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGS.map((l) => (
                        <SelectItem key={l.v} value={l.v}>
                          {l.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utilidade (transacional)</SelectItem>
                    <SelectItem value="AUTHENTICATION">Autenticação (códigos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Header */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Cabeçalho</h3>
                <Select
                  value={header.format}
                  onValueChange={(v: any) => {
                    if (v === "NONE") setHeader({ format: "NONE" });
                    else if (v === "TEXT") setHeader({ format: "TEXT", text: "" });
                    else if (v === "LOCATION") setHeader({ format: "LOCATION" });
                    else setHeader({ format: v, example_url: "" });
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                    <SelectItem value="TEXT">Texto</SelectItem>
                    <SelectItem value="IMAGE">Imagem</SelectItem>
                    <SelectItem value="VIDEO">Vídeo</SelectItem>
                    <SelectItem value="DOCUMENT">Documento</SelectItem>
                    <SelectItem value="LOCATION">Localização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {header.format === "TEXT" && (
                <div>
                  <Input
                    placeholder="Título (até 60 caracteres)"
                    maxLength={60}
                    value={header.text}
                    onChange={(e) => setHeader({ format: "TEXT", text: e.target.value })}
                  />
                </div>
              )}
              {(header.format === "IMAGE" ||
                header.format === "VIDEO" ||
                header.format === "DOCUMENT") && (
                <div>
                  <Label>URL de exemplo ({header.format.toLowerCase()})</Label>
                  <Input
                    placeholder="https://…"
                    value={header.example_url}
                    onChange={(e) =>
                      setHeader({ format: header.format, example_url: e.target.value })
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    A Meta exige um exemplo para aprovar.
                  </p>
                </div>
              )}
            </Card>

            {/* Body */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Mensagem</h3>
                <span className="text-xs text-muted-foreground">{body.length}/1024</span>
              </div>
              <Textarea
                rows={5}
                maxLength={1024}
                placeholder="Olá {{1}}, sua reserva em {{2}} foi confirmada."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Use{" "}
                <code>
                  {"{{1}}"}, {"{{2}}"}
                </code>{" "}
                etc. para variáveis dinâmicas.
              </p>
              {bodyPlaceholders.length > 0 && (
                <div className="space-y-2 rounded border bg-muted/30 p-3">
                  <p className="text-xs font-medium">
                    Exemplos para aprovação ({bodyPlaceholders.length})
                  </p>
                  {bodyPlaceholders.map((placeholder, i) => (
                    <Input
                      key={`${placeholder}-${i}`}
                      placeholder={`Exemplo para {{${placeholder}}}`}
                      value={bodyExamples[i] ?? ""}
                      onChange={(e) => {
                        const next = [...bodyExamples];
                        next[i] = e.target.value;
                        setBodyExamples(next);
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Footer */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Rodapé (opcional)</h3>
                <span className="text-xs text-muted-foreground">{footer.length}/60</span>
              </div>
              <Input
                maxLength={60}
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="ex: Equipe Acme"
              />
            </Card>

            {/* Buttons */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">Botões ({buttons.length}/10)</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("QUICK_REPLY")}
                  disabled={buttons.length >= 10}
                >
                  <Reply className="mr-1 h-3.5 w-3.5" /> Resposta rápida
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("URL")}
                  disabled={buttons.length >= 10}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("PHONE_NUMBER")}
                  disabled={buttons.length >= 10}
                >
                  <Phone className="mr-1 h-3.5 w-3.5" /> Telefone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("COPY_CODE")}
                  disabled={buttons.length >= 10}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copiar código
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("CATALOG")}
                  disabled={buttons.length >= 10}
                >
                  <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Catálogo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("MPM")}
                  disabled={buttons.length >= 10}
                >
                  <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Multi-produto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("FLOW")}
                  disabled={buttons.length >= 10}
                >
                  <Zap className="mr-1 h-3.5 w-3.5" /> Flow
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("OTP")}
                  disabled={buttons.length >= 10}
                >
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> OTP (auth)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addButton("VOICE_CALL")}
                  disabled={buttons.length >= 10}
                >
                  <PhoneCall className="mr-1 h-3.5 w-3.5" /> Chamada
                </Button>
              </div>
              {buttons.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum botão. A Meta exige tipos compatíveis (ex.: OTP só em templates de
                  Autenticação; Catálogo/MPM exigem catálogo conectado).
                </p>
              )}
              <div className="space-y-2">
                {buttons.map((b, i) => {
                  const labels: Record<string, string> = {
                    QUICK_REPLY: "Resposta",
                    URL: "Link",
                    PHONE_NUMBER: "Telefone",
                    COPY_CODE: "Cód.",
                    CATALOG: "Catálogo",
                    MPM: "Produtos",
                    FLOW: "Flow",
                    OTP: "OTP",
                    VOICE_CALL: "Voz",
                  };
                  return (
                    <div key={i} className="flex items-start gap-2 rounded border p-2">
                      <span className="mt-2 w-16 shrink-0 text-xs font-medium text-muted-foreground">
                        {labels[b.type]}
                      </span>
                      <div className="flex-1 grid gap-2 md:grid-cols-2">
                        {b.type === "QUICK_REPLY" && (
                          <Input
                            className="md:col-span-2"
                            placeholder="Texto (até 25)"
                            maxLength={25}
                            value={b.text}
                            onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                          />
                        )}
                        {b.type === "URL" && (
                          <>
                            <Input
                              placeholder="Texto do botão"
                              maxLength={25}
                              value={b.text}
                              onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                            />
                            <Input
                              placeholder="https://exemplo.com/{{1}}"
                              value={b.url}
                              onChange={(e) => updateButton(i, { url: e.target.value } as any)}
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground leading-normal md:col-span-2">
                              Para tornar o link dinâmico e personalizável ao disparar campanhas,
                              termine a URL com <code>{"{{1}}"}</code> (ex:{" "}
                              <code>https://site.com/cupom/{"{{1}}"}</code>). O texto do botão (CTA)
                              é estático na Meta.
                            </p>
                            {b.url.includes("{{1}}") && (
                              <Input
                                className="md:col-span-2"
                                placeholder="Exemplo do valor de {{1}} na URL"
                                value={b.example?.[0] ?? ""}
                                onChange={(e) =>
                                  updateButton(i, { example: [e.target.value] } as any)
                                }
                              />
                            )}
                          </>
                        )}
                        {b.type === "PHONE_NUMBER" && (
                          <>
                            <Input
                              placeholder="Texto do botão"
                              maxLength={25}
                              value={b.text}
                              onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                            />
                            <Input
                              placeholder="+5511999999999"
                              value={b.phone_number}
                              onChange={(e) =>
                                updateButton(i, { phone_number: e.target.value } as any)
                              }
                            />
                          </>
                        )}
                        {b.type === "COPY_CODE" && (
                          <Input
                            className="md:col-span-2"
                            placeholder="Código de exemplo (ex.: PROMO10)"
                            maxLength={15}
                            value={b.example[0] ?? ""}
                            onChange={(e) => updateButton(i, { example: [e.target.value] } as any)}
                          />
                        )}
                        {(b.type === "CATALOG" || b.type === "MPM" || b.type === "VOICE_CALL") && (
                          <Input
                            className="md:col-span-2"
                            placeholder="Texto do botão"
                            maxLength={25}
                            value={b.text}
                            onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                          />
                        )}
                        {b.type === "FLOW" && (
                          <>
                            <Input
                              placeholder="Texto do botão"
                              maxLength={25}
                              value={b.text}
                              onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                            />
                            <Input
                              placeholder="Flow ID"
                              value={b.flow_id}
                              onChange={(e) => updateButton(i, { flow_id: e.target.value } as any)}
                            />
                            <Select
                              value={b.flow_action}
                              onValueChange={(v: any) => updateButton(i, { flow_action: v } as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="navigate">navigate</SelectItem>
                                <SelectItem value="data_exchange">data_exchange</SelectItem>
                              </SelectContent>
                            </Select>
                            {b.flow_action === "navigate" && (
                              <Input
                                placeholder="Tela inicial (opcional)"
                                value={b.navigate_screen ?? ""}
                                onChange={(e) =>
                                  updateButton(i, { navigate_screen: e.target.value } as any)
                                }
                              />
                            )}
                          </>
                        )}
                        {b.type === "OTP" && (
                          <>
                            <Select
                              value={b.otp_type}
                              onValueChange={(v: any) => updateButton(i, { otp_type: v } as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="COPY_CODE">Copy code</SelectItem>
                                <SelectItem value="ONE_TAP">One-tap autofill</SelectItem>
                                <SelectItem value="ZERO_TAP">Zero-tap</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Texto do botão (opcional)"
                              maxLength={25}
                              value={b.text ?? ""}
                              onChange={(e) => updateButton(i, { text: e.target.value } as any)}
                            />
                            {(b.otp_type === "ONE_TAP" || b.otp_type === "ZERO_TAP") && (
                              <>
                                <Input
                                  placeholder="Autofill text"
                                  maxLength={25}
                                  value={b.autofill_text ?? ""}
                                  onChange={(e) =>
                                    updateButton(i, { autofill_text: e.target.value } as any)
                                  }
                                />
                                <Input
                                  placeholder="Package name (Android)"
                                  value={b.package_name ?? ""}
                                  onChange={(e) =>
                                    updateButton(i, { package_name: e.target.value } as any)
                                  }
                                />
                                <Input
                                  className="md:col-span-2"
                                  placeholder="Signature hash (Android)"
                                  value={b.signature_hash ?? ""}
                                  onChange={(e) =>
                                    updateButton(i, { signature_hash: e.target.value } as any)
                                  }
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Advanced Settings */}
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center gap-2 bg-muted/40 p-4 text-left font-medium transition hover:bg-muted/60"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span>Configurações Avançadas (Opcional)</span>
                <ChevronDown
                  className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showAdvanced && (
                <div className="p-4 space-y-4 border-t bg-card text-card-foreground">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Formato dos Parâmetros */}
                    <div className="space-y-1.5">
                      <Label>Formato dos Parâmetros</Label>
                      <Select
                        value={parameterFormat}
                        onValueChange={(v: any) => setParameterFormat(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o formato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Padrão da Meta</SelectItem>
                          <SelectItem value="POSITIONAL">Posicional ({"{{1}}, {{2}}"})</SelectItem>
                          <SelectItem value="NAMED">Nomeado (Variáveis por nome)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Define como os parâmetros dinâmicos são estruturados.
                      </p>
                    </div>

                    {/* TTL (Seconds) */}
                    <div className="space-y-1.5">
                      <Label>Tempo de Vida (TTL - Segundos)</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 86400 (24 horas)"
                        value={messageSendTtlSeconds}
                        onChange={(e) => setMessageSendTtlSeconds(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Prazo máximo de validade para entrega das mensagens.
                      </p>
                    </div>
                  </div>

                  {category === "UTILITY" && (
                    <div className="space-y-1.5">
                      <Label>Sub-categoria de Utilidade</Label>
                      <Select value={subCategory} onValueChange={setSubCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a subcategoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Nenhuma</SelectItem>
                          <SelectItem value="BOOKING_STATUS">
                            Status da Reserva (BOOKING_STATUS)
                          </SelectItem>
                          <SelectItem value="CALL_PERMISSIONS_REQUEST">
                            Permissões de Chamada (CALL_PERMISSIONS_REQUEST)
                          </SelectItem>
                          <SelectItem value="FLIGHT_DELAY_AND_GATE_CHANGE_ALERT">
                            Aviso de Voo (FLIGHT_DELAY_AND_GATE_CHANGE_ALERT)
                          </SelectItem>
                          <SelectItem value="FRAUD_ALERT">
                            Alerta de Fraude (FRAUD_ALERT)
                          </SelectItem>
                          <SelectItem value="ORDER_DETAILS">
                            Detalhes do Pedido (ORDER_DETAILS)
                          </SelectItem>
                          <SelectItem value="ORDER_STATUS">
                            Status do Pedido (ORDER_STATUS)
                          </SelectItem>
                          <SelectItem value="RICH_ORDER_STATUS">
                            Status do Pedido Completo (RICH_ORDER_STATUS)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Classificação específica exigida para certos fluxos transacionais.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/10 p-3 hover:bg-muted/20">
                      <Checkbox
                        checked={allowCategoryChange}
                        onCheckedChange={(checked) => setAllowCategoryChange(!!checked)}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <span className="text-xs font-semibold">
                          Permitir reclassificação automática
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Autoriza a Meta a alterar a categoria do template caso divirja da análise
                          interna.
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/10 p-3 hover:bg-muted/20">
                      <Checkbox
                        checked={ctaUrlLinkTrackingOptedOut}
                        onCheckedChange={(checked) => setCtaUrlLinkTrackingOptedOut(!!checked)}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <span className="text-xs font-semibold">
                          Desativar rastreamento de links CTA
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Remove o rastreamento automático do engajamento em botões do tipo URL.
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/10 p-3 hover:bg-muted/20">
                      <Checkbox
                        checked={isPrimaryDeviceDeliveryOnly}
                        onCheckedChange={(checked) => setIsPrimaryDeviceDeliveryOnly(!!checked)}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <span className="text-xs font-semibold">
                          Entrega exclusiva no dispositivo primário
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Restringe a entrega de mensagens apenas para o smartphone principal do
                          destinatário.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </Card>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !name || !body}
              >
                {!template && <Plus className="mr-1 h-4 w-4" />}
                {mutation.isPending
                  ? "Salvando…"
                  : template
                    ? "Salvar alterações"
                    : "Criar template"}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Pré-visualização</p>
            <div className="sticky top-0">
              {previewComponents.length > 0 ? (
                <WhatsAppPreview components={previewComponents} />
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-xs text-muted-foreground">
                  Preencha a mensagem para ver o preview.
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Se as credenciais da Meta estiverem configuradas, o template é enviado para
                aprovação. Caso contrário, fica salvo localmente como PENDING.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
