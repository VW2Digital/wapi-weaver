// DS Agente Manager — v2
import { useState } from "react";
import { FolderGrid } from "./FolderGrid";
import { AgentGrid } from "./AgentGrid";
import { AgentEditor } from "./AgentEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFolders, listAgents } from "@/lib/ds-agent.functions";
import { Loader2 } from "lucide-react";

export type ViewState =
  | { type: "folders" }
  | { type: "folder"; folderId: string | null }
  | { type: "editor"; agentId: string | null; folderId?: string | null };

export function AiAgentManager() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewState>({ type: "folders" });

  const getFolders = useServerFn(listFolders);
  const getAgents = useServerFn(listAgents);

  const foldersQuery = useQuery({
    queryKey: ["ds-agent-folders"],
    queryFn: () => getFolders(),
  });

  const agentsQuery = useQuery({
    queryKey: ["ds-agents"],
    queryFn: () => getAgents({ data: { folder_id: undefined } }),
  });

  if (foldersQuery.isLoading || agentsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const folders: any[] = foldersQuery.data || [];
  const agents: any[] = agentsQuery.data || [];

  const handleAgentCreated = (_id: string) => {
    qc.invalidateQueries({ queryKey: ["ds-agent-folders"] });
    qc.invalidateQueries({ queryKey: ["ds-agents"] });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/10">
      {view.type === "folders" && (
        <FolderGrid
          folders={folders}
          agents={agents}
          onOpenFolder={(id: string | null) => setView({ type: "folder", folderId: id })}
          onNewAgent={() => setView({ type: "editor", agentId: null, folderId: null })}
          onEditAgent={(id: string) => setView({ type: "editor", agentId: id })}
        />
      )}

      {view.type === "folder" && (
        <AgentGrid
          folderId={view.folderId}
          folderName={
            view.folderId
              ? folders.find((f: any) => f.id === view.folderId)?.name || "Pasta"
              : "Agentes Sem Pasta"
          }
          agents={agents.filter((a: any) => a.folder_id === view.folderId)}
          onBack={() => setView({ type: "folders" })}
          onNewAgent={() => setView({ type: "editor", agentId: null, folderId: view.folderId })}
          onEditAgent={(id: string) => setView({ type: "editor", agentId: id, folderId: view.folderId })}
        />
      )}

      {view.type === "editor" && (
        <AgentEditor
          agentId={view.agentId}
          folderId={view.folderId}
          onBack={() => {
            if (view.folderId != null) {
              setView({ type: "folder", folderId: view.folderId });
            } else {
              setView({ type: "folders" });
            }
          }}
          onCreated={handleAgentCreated}
        />
      )}
    </div>
  );
}
