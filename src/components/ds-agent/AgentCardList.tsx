import React from "react";
import { ArrowLeft, Bot, Plus, Trash2, Cpu, Sparkles, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AgentItem {
  id: string;
  name: string;
  provider: string;
  model: string;
  folder_id?: string | null;
  mode?: "basico" | "avancado";
}

interface AgentCardListProps {
  folderName: string;
  folderId: string | null;
  agents: AgentItem[];
  onBackToFolders: () => void;
  onSelectAgent: (agentId: string) => void;
  onOpenCreateAgentModal: () => void;
  onDeleteAgent?: (agentId: string) => void;
  onDropRemoveFromFolder?: (agentId: string) => void;
}

export function AgentCardList({
  folderName,
  folderId,
  agents,
  onBackToFolders,
  onSelectAgent,
  onOpenCreateAgentModal,
  onDeleteAgent,
  onDropRemoveFromFolder,
}: AgentCardListProps) {
  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData("agentId", agentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropRemove = (e: React.DragEvent) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData("agentId");
    if (agentId && onDropRemoveFromFolder) {
      onDropRemoveFromFolder(agentId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToFolders}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-2 font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para pastas
          </button>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground flex items-center gap-3">
            {folderName}
            <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
              {agents.length} {agents.length === 1 ? "Agente" : "Agentes"}
            </Badge>
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Drop Zone Visual Indicator */}
          {folderId !== null && folderId !== "unassigned" && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropRemove}
              className="hidden md:flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <Move className="h-3.5 w-3.5 text-primary" />
              <span>Solte um item aqui para removê-lo da pasta</span>
            </div>
          )}

          <Button
            onClick={onOpenCreateAgentModal}
            className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95"
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar Agente
          </Button>
        </div>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="rounded-full bg-muted p-4 text-muted-foreground mb-3">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-base font-display font-semibold text-foreground">Nenhum agente nesta pasta</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Clique no botão acima para adicionar um novo agente virtual de IA a esta pasta.
          </p>
          <Button
            onClick={onOpenCreateAgentModal}
            size="sm"
            className="mt-4 bg-primary text-primary-foreground font-semibold hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar Agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => handleDragStart(e, agent.id)}
              onClick={() => onSelectAgent(agent.id)}
              className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Bliv Primary Chip Icon */}
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                      {agent.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{agent.provider || "OpenAI Padrão"}</span>
                      <span className="text-muted-foreground">•</span>
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-[10px] px-1.5 py-0">
                        {agent.model || "gpt-4o-mini"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {onDeleteAgent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Excluir o agente "${agent.name}"?`)) {
                        onDeleteAgent(agent.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span>Modo {agent.mode === "avancado" ? "Avançado" : "Básico"}</span>
                </div>
                <span className="text-primary font-medium group-hover:underline">Editar Agente →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
