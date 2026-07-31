import React, { useState } from "react";
import { Upload, FileText, Link, Plus, Trash2, Globe, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_size_kb: number;
  page_count: number;
  status: "ativo" | "inativo";
  uploaded_at: string;
}

interface KnowledgeLink {
  id: string;
  url: string;
  status: "pendente" | "indexado" | "erro";
  created_at: string;
}

interface TabKnowledgeProps {
  files: KnowledgeFile[];
  links: KnowledgeLink[];
  onUploadFile: (fileName: string, fileSizeKb: number, pageCount: number) => void;
  onDeleteFile: (id: string) => void;
  onAddLink: (url: string) => void;
  onDeleteLink: (id: string) => void;
}

export function TabKnowledge({
  files,
  links,
  onUploadFile,
  onDeleteFile,
  onAddLink,
  onDeleteLink,
}: TabKnowledgeProps) {
  const [newUrl, setNewUrl] = useState("");

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [".pdf", ".docx", ".txt", ".csv"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      alert("Formato não suportado. Por favor, envie apenas arquivos PDF, DOCX, TXT ou CSV.");
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const pages = Math.floor(Math.random() * 8) + 1;
    onUploadFile(file.name, sizeKb, pages);
    e.target.value = "";
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    onAddLink(newUrl.trim());
    setNewUrl("");
  };

  return (
    <div className="space-y-8">
      {/* File Base Section */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" /> Base de Conhecimento (Documentos)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Adicione documentos para que a IA utilize como referência nas conversas. Formatos aceitos: <strong className="text-foreground">PDF, DOCX, TXT, CSV</strong>.
            </p>
          </div>

          <label className="cursor-pointer">
            <span className="inline-flex items-center justify-center rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-all">
              <Upload className="mr-2 h-4 w-4" /> Enviar Arquivo
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv"
              onChange={handleSimulatedFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-semibold text-foreground">Nenhum documento enviado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie arquivos PDF ou TXT para treinar o agente com seus produtos e serviços.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                      {file.file_name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.file_size_kb} KB • {file.page_count} {file.page_count === 1 ? "página" : "páginas"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                    Ativo
                  </Badge>
                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links and URLs Section */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Links e URLs
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Insira links de sites, artigos ou documentações públicas para indexação contínua.
          </p>
        </div>

        <form onSubmit={handleAddLink} className="flex gap-2">
          <Input
            type="url"
            placeholder="https://suaempresa.com.br/faq"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
          />
          <Button type="submit" className="bg-primary text-primary-foreground font-semibold hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </form>

        {links.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground">
            Nenhuma URL cadastrada para indexação.
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3.5"
              >
                <div className="flex items-center gap-3">
                  <Link className="h-4 w-4 text-primary" />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-foreground hover:text-primary underline truncate max-w-[300px] sm:max-w-[500px]"
                  >
                    {link.url}
                  </a>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                    Indexado
                  </Badge>
                  <button
                    onClick={() => onDeleteLink(link.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
