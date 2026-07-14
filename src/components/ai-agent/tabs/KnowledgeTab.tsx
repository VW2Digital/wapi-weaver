import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listKnowledge, saveKnowledge, deleteKnowledge } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, FileText, BookOpen, MessageSquare, Loader2, Upload, File } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

const TYPE_ICONS: Record<string, any> = {
  text: FileText,
  faq: MessageSquare,
  url: BookOpen,
  pdf: File,
};

const TYPE_LABELS: Record<string, string> = {
  text: "Texto livre",
  faq: "FAQ",
  url: "URL / Site",
  pdf: "Documento (PDF/TXT)",
};

/**
 * Extracts readable text from a PDF file using basic binary parsing.
 * This handles most simple PDFs. For complex PDFs, the text may be incomplete.
 */
function extractTextFromPdf(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder("latin1").decode(bytes);

  // Extract text between BT (Begin Text) and ET (End Text) operators
  const textBlocks: string[] = [];
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Extract Tj and TJ text operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textBlocks.push(tjMatch[1]);
    }

    // TJ arrays: [(text) num (text) ...]
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        textBlocks.push(strMatch[1]);
      }
    }
  }

  let extracted = textBlocks.join(" ")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\s{3,}/g, "\n\n")
    .trim();

  // If BT/ET extraction failed, try a simpler approach — extract readable ASCII runs
  if (!extracted || extracted.length < 20) {
    const readable: string[] = [];
    let current = "";
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 32 && b < 127) {
        current += String.fromCharCode(b);
      } else {
        if (current.length > 4) {
          readable.push(current);
        }
        current = "";
      }
    }
    if (current.length > 4) readable.push(current);
    extracted = readable
      .filter(s => !s.startsWith("/") && !s.startsWith("<<") && !s.includes("obj") && s.length > 6)
      .join(" ")
      .replace(/\s{3,}/g, "\n\n")
      .substring(0, 100000)
      .trim();
  }

  return extracted;
}

export function KnowledgeTab({ agentId }: { agentId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listKnowledge);
  const saveFn = useServerFn(saveKnowledge);
  const deleteFn = useServerFn(deleteKnowledge);
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "text", content: "" });
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ds-knowledge", agentId],
    queryFn: () => listFn({ data: { agent_id: agentId! } }),
    enabled: !!agentId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { agent_id: agentId!, ...form } }),
    onSuccess: () => {
      toast.success("Conhecimento adicionado!");
      qc.invalidateQueries({ queryKey: ["ds-knowledge", agentId] });
      setOpen(false);
      setForm({ title: "", type: "text", content: "" });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["ds-knowledge", agentId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);

    try {
      const fileName = file.name;
      const ext = fileName.split(".").pop()?.toLowerCase();

      if (ext === "txt" || ext === "md" || ext === "csv") {
        // Plain text files
        const text = await file.text();
        setForm({
          title: fileName,
          type: "text",
          content: text.substring(0, 100000), // limit to 100k chars
        });
        toast.success(`Arquivo "${fileName}" carregado!`);
      } else if (ext === "pdf") {
        // PDF files — extract text client-side
        const arrayBuffer = await file.arrayBuffer();
        const extracted = extractTextFromPdf(arrayBuffer);

        if (!extracted || extracted.length < 10) {
          toast.warning("Não foi possível extrair texto legível deste PDF. O PDF pode conter apenas imagens. Tente colar o texto manualmente.");
          setForm({
            title: fileName,
            type: "pdf",
            content: "",
          });
        } else {
          setForm({
            title: fileName,
            type: "pdf",
            content: extracted.substring(0, 100000),
          });
          toast.success(`Texto extraído do PDF "${fileName}" (${extracted.length} caracteres)`);
        }
      } else {
        toast.error("Formato não suportado. Use .pdf, .txt, .md ou .csv");
      }
    } catch (err: any) {
      toast.error("Erro ao processar arquivo: " + (err?.message || "desconhecido"));
    } finally {
      setIsProcessingFile(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
        <p className="text-muted-foreground text-sm">Crie e salve o agente primeiro para adicionar conhecimento.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Base de Conhecimento</h3>
          <p className="text-sm text-muted-foreground">Adicione textos, FAQs ou URLs que o agente usará como contexto.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="border rounded-lg p-12 text-center border-dashed">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm">Nenhum documento na base de conhecimento.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar primeiro item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const Icon = TYPE_ICONS[item.type] || FileText;
            return (
              <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg bg-background hover:shadow-sm transition-shadow">
                <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.content?.substring(0, 100)}
                    {item.content?.length > 100 ? "..." : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{TYPE_LABELS[item.type] || item.type}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  disabled={deleteMut.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Remover este item?",
                      description: `"${item.title}" será removido permanentemente da base de conhecimento.`,
                      confirmText: "Remover",
                      destructive: true,
                    });
                    if (ok) deleteMut.mutate(item.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Adicionar ao Conhecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Upload Zone */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              {isProcessingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">Clique para enviar um arquivo</p>
                  <p className="text-xs text-muted-foreground">PDF, TXT, MD ou CSV (máx. 100KB de texto)</p>
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground bg-background px-2">ou preencha manualmente</span>
              <div className="flex-1 border-t" />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto livre</SelectItem>
                  <SelectItem value="faq">FAQ (Pergunta / Resposta)</SelectItem>
                  <SelectItem value="url">URL / Site</SelectItem>
                  <SelectItem value="pdf">Documento (PDF/TXT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Política de devolução"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{form.type === "url" ? "URL" : "Conteúdo"}</Label>
              {form.type === "url" ? (
                <Input
                  placeholder="https://..."
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                />
              ) : (
                <Textarea
                  className="min-h-[200px] resize-y font-mono text-sm"
                  placeholder={
                    form.type === "faq"
                      ? "P: Pergunta?\nR: Resposta."
                      : form.type === "pdf"
                      ? "O texto extraído do arquivo aparecerá aqui. Você também pode colar/editar manualmente."
                      : "Cole o texto aqui..."
                  }
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                />
              )}
              {form.content && (
                <p className="text-[10px] text-muted-foreground text-right">
                  {form.content.length.toLocaleString("pt-BR")} caracteres
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!form.title || !form.content || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
