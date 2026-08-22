import React, { useState } from "react";
import { Folder, Plus, X, Search, Info, Bot, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface FolderItem {
  id: string;
  name: string;
  agent_count: number;
}

interface FolderGridProps {
  folders: FolderItem[];
  unassignedCount: number;
  searchTerm?: string;
  onSelectFolder: (folderId: string | null, folderName: string) => void;
  onCreateFolder: (name: string) => void;
  onOpenCreateAgentModal: () => void;
  onDeleteFolder?: (id: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDropAgentToFolder?: (agentId: string, folderId: string | null) => void;
}

export function FolderGrid({
  folders,
  unassignedCount,
  searchTerm = "",
  onSelectFolder,
  onCreateFolder,
  onOpenCreateAgentModal,
  onDeleteFolder,
  onRenameFolder,
  onDropAgentToFolder,
}: FolderGridProps) {
  const [showBanner, setShowBanner] = useState(true);

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData("agentId");
    if (agentId && onDropAgentToFolder) {
      onDropAgentToFolder(agentId, folderId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dismissible Information Banner */}
      {showBanner && (
        <div className="relative flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-foreground">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1 pr-6 text-sm">
            <p className="font-semibold font-display text-foreground">Dica de uso do DS Agente</p>
            <p className="mt-0.5 text-muted-foreground">
              Clique em uma pasta para ver os agentes de IA! Abra a pasta, selecione um agente e veja o editor completo com treinamento, teste e mais.
            </p>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Folder Grid Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Unassigned Folder Card */}
        <div
          onClick={() => onSelectFolder("unassigned", "Sem Pasta / Agentes Gerais")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
          className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-0.5 rounded-full">
              {unassignedCount}
            </Badge>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-display font-semibold text-foreground group-hover:text-primary transition-colors">
              Agentes Soltos (Sem Pasta)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Agentes não vinculados a uma pasta específica.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Ver agentes</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-primary" />
          </div>
        </div>

        {/* Dynamic Folders */}
        {filteredFolders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder.id, folder.name)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, folder.id)}
            className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                <Folder className="h-6 w-6 fill-primary/20" />
              </div>
              <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-0.5 rounded-full">
                {folder.agent_count}
              </Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-display font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {folder.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {folder.agent_count === 1 ? "1 agente" : `${folder.agent_count} agentes`}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="group-hover:text-foreground">Abrir pasta</span>
              <div className="flex items-center gap-1">
                {onDeleteFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Excluir a pasta "${folder.name}"?`)) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
