import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Sparkles } from "lucide-react";

interface FolderOption {
  id: string;
  name: string;
}

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAgent: (data: { name: string; folder_id: string | null; model: string; provider: string }) => void;
  folders: FolderOption[];
  defaultFolderId?: string | null;
}

export function CreateAgentModal({
  isOpen,
  onClose,
  onCreateAgent,
  folders,
  defaultFolderId,
}: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string>(defaultFolderId || "unassigned");
  const [model, setModel] = useState("gpt-4o-mini");
  const [provider, setProvider] = useState("OpenAI Padrão");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateAgent({
      name: name.trim(),
      folder_id: folderId === "unassigned" ? null : folderId,
      model,
      provider,
    });

    setName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border text-card-foreground">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display font-bold text-foreground">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              Novo Agente de IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name" className="text-foreground font-medium">
                Nome do Agente
              </Label>
              <Input
                id="agent-name"
                placeholder="Ex: SDR – Qualificação"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-medium">Pasta Destino</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="unassigned">Sem Pasta (Agente Solto)</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-medium">Provedor e Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="gpt-4o-mini">OpenAI Padrão — GPT-4o Mini (Rápido e Econômico)</SelectItem>
                  <SelectItem value="gpt-4o">OpenAI Padrão — GPT-4o (Avançado e Raciocínio)</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Google Gemini — 2.5 Flash</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Google Gemini — 2.5 Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border bg-card text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95"
            >
              Criar Agente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
