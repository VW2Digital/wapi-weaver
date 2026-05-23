import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Phone, Reply } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { createTemplate, type CreateTemplateInput } from "@/lib/templates.functions";

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
  | { type: "FLOW"; text: string; flow_id: string; flow_action: "navigate" | "data_exchange"; navigate_screen?: string }
  | { type: "OTP"; otp_type: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP"; text?: string; autofill_text?: string; package_name?: string; signature_hash?: string }
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
  const matches = text.match(/\{\{\s*\d+\s*\}\}/g) ?? [];
  const nums = matches.map((m) => parseInt(m.replace(/[^\d]/g, ""), 10)).filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

export function TemplateBuilderDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const submit = useServerFn(createTemplate);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");
  const [header, setHeader] = useState<HeaderState>({ format: "NONE" });
  const [body, setBody] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonState[]>([]);

  const bodyVarCount = extractVarCount(body);
  useEffect(() => {
    setBodyExamples((prev) => {
      if (prev.length === bodyVarCount) return prev;
      return Array.from({ length: bodyVarCount }, (_, i) => prev[i] ?? "");
    });
  }, [bodyVarCount]);

  const previewComponents: any[] = [];
  if (header.format === "TEXT") {
    previewComponents.push({ type: "HEADER", format: "TEXT", text: header.text });
  } else if (header.format === "IMAGE" || header.format === "VIDEO" || header.format === "DOCUMENT") {
    previewComponents.push({ type: "HEADER", format: header.format, example: { header_handle: [header.example_url] } });
  } else if (header.format === "LOCATION") {
    previewComponents.push({ type: "HEADER", format: "LOCATION" });
  }
  if (body) previewComponents.push({ type: "BODY", text: body });
  if (footer) previewComponents.push({ type: "FOOTER", text: footer });
  if (buttons.length) previewComponents.push({ type: "BUTTONS", buttons });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateTemplateInput = {
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
      };
      return submit({ data: payload });
    },
    onSuccess: () => {
      toast.success("Template criado. Aguarde a análise da Meta.");
      qc.invalidateQueries({ queryKey: ["templates"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar template"),
  });

  function reset() {
    setName(""); setLanguage("pt_BR"); setCategory("MARKETING");
    setHeader({ format: "NONE" }); setBody(""); setBodyExamples([]);
    setFooter(""); setButtons([]);
  }

  function addButton(type: ButtonState["type"]) {
    if (buttons.length >= 10) return;
    let nb: ButtonState;
    switch (type) {
      case "QUICK_REPLY": nb = { type, text: "" }; break;
      case "URL": nb = { type, text: "", url: "https://" }; break;
      case "PHONE_NUMBER": nb = { type, text: "", phone_number: "+55" }; break;
      case "COPY_CODE": nb = { type, example: [""] }; break;
      case "CATALOG": nb = { type, text: "Ver catálogo" }; break;
      case "MPM": nb = { type, text: "Ver produtos" }; break;
      case "FLOW": nb = { type, text: "", flow_id: "", flow_action: "navigate" }; break;
      case "OTP": nb = { type, otp_type: "COPY_CODE", text: "Copiar código" }; break;
      case "VOICE_CALL": nb = { type, text: "Ligar" }; break;
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo template</DialogTitle>
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
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">minúsculas, números e _</p>
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={header.format} onValueChange={(v: any) => {
                  if (v === "NONE") setHeader({ format: "NONE" });
                  else if (v === "TEXT") setHeader({ format: "TEXT", text: "" });
                  else setHeader({ format: v, example_url: "" });
                }}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                    <SelectItem value="TEXT">Texto</SelectItem>
                    <SelectItem value="IMAGE">Imagem</SelectItem>
                    <SelectItem value="VIDEO">Vídeo</SelectItem>
                    <SelectItem value="DOCUMENT">Documento</SelectItem>
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
              {(header.format === "IMAGE" || header.format === "VIDEO" || header.format === "DOCUMENT") && (
                <div>
                  <Label>URL de exemplo ({header.format.toLowerCase()})</Label>
                  <Input
                    placeholder="https://…"
                    value={header.example_url}
                    onChange={(e) => setHeader({ format: header.format, example_url: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">A Meta exige um exemplo para aprovar.</p>
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
                Use <code>{"{{1}}"}, {"{{2}}"}</code> etc. para variáveis dinâmicas.
              </p>
              {bodyVarCount > 0 && (
                <div className="space-y-2 rounded border bg-muted/30 p-3">
                  <p className="text-xs font-medium">Exemplos para aprovação ({bodyVarCount})</p>
                  {Array.from({ length: bodyVarCount }).map((_, i) => (
                    <Input
                      key={i}
                      placeholder={`Exemplo para {{${i + 1}}}`}
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
              <Input maxLength={60} value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="ex: Equipe Acme" />
            </Card>

            {/* Buttons */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Botões ({buttons.length}/10)</h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addButton("QUICK_REPLY")} disabled={buttons.length >= 10}>
                    <Reply className="mr-1 h-3.5 w-3.5" /> Resposta rápida
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addButton("URL")} disabled={buttons.length >= 10}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addButton("PHONE_NUMBER")} disabled={buttons.length >= 10}>
                    <Phone className="mr-1 h-3.5 w-3.5" /> Telefone
                  </Button>
                </div>
              </div>
              {buttons.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum botão. Adicione até 10 (Meta exige tipos compatíveis).</p>
              )}
              <div className="space-y-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border p-2">
                    <span className="mt-2 text-xs font-medium text-muted-foreground w-16">
                      {b.type === "QUICK_REPLY" ? "Resposta" : b.type === "URL" ? "Link" : "Telefone"}
                    </span>
                    <div className="flex-1 grid gap-2 md:grid-cols-2">
                      <Input
                        placeholder="Texto do botão (até 25)"
                        maxLength={25}
                        value={b.text}
                        onChange={(e) => {
                          const next = [...buttons]; next[i] = { ...b, text: e.target.value }; setButtons(next);
                        }}
                      />
                      {b.type === "URL" && (
                        <Input
                          placeholder="https://…"
                          value={b.url}
                          onChange={(e) => {
                            const next = [...buttons]; next[i] = { ...b, url: e.target.value }; setButtons(next);
                          }}
                        />
                      )}
                      {b.type === "PHONE_NUMBER" && (
                        <Input
                          placeholder="+5511999999999"
                          value={b.phone_number}
                          onChange={(e) => {
                            const next = [...buttons]; next[i] = { ...b, phone_number: e.target.value }; setButtons(next);
                          }}
                        />
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>Cancelar</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !name || !body}
              >
                <Plus className="mr-1 h-4 w-4" />
                {mutation.isPending ? "Enviando…" : "Criar template"}
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
                Se as credenciais da Meta estiverem configuradas, o template é enviado para aprovação. Caso contrário, fica salvo localmente como PENDING.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
