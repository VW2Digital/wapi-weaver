import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { FolderGrid } from "@/components/ds-agent/FolderGrid";
import { AgentCardList } from "@/components/ds-agent/AgentCardList";
import { CreateAgentModal } from "@/components/ds-agent/CreateAgentModal";
import {
  getDsFolders,
  createDsFolder,
  deleteDsFolder,
  getDsAgentsByFolder,
  createDsAgent,
  deleteDsAgent,
  moveDsAgent,
} from "@/lib/ds-agent.functions";
import { toast } from "sonner";

function DsAgenteMainPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getFoldersFn = useServerFn(getDsFolders);
  const createFolderFn = useServerFn(createDsFolder);
  const deleteFolderFn = useServerFn(deleteDsFolder);
  const getAgentsFn = useServerFn(getDsAgentsByFolder);
  const createAgentFn = useServerFn(createDsAgent);
  const deleteAgentFn = useServerFn(deleteDsAgent);
  const moveAgentFn = useServerFn(moveDsAgent);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "overview">("overview");
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");
  const [isCreateAgentModalOpen, setIsCreateAgentModalOpen] = useState(false);

  // Queries
  const foldersQuery = useQuery({
    queryKey: ["dsFolders"],
    queryFn: () => getFoldersFn(),
  });

  const agentsQuery = useQuery({
    queryKey: ["dsAgents", selectedFolderId],
    queryFn: () => getAgentsFn({ data: { folderId: selectedFolderId === "overview" ? null : selectedFolderId } }),
    enabled: selectedFolderId !== "overview",
  });

  // Mutations
  const createFolderMut = useMutation({
    mutationFn: (name: string) => createFolderFn({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsFolders"] });
      toast.success("Pasta criada com sucesso!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar pasta"),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => deleteFolderFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsFolders"] });
      setSelectedFolderId("overview");
      toast.success("Pasta excluída.");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir pasta"),
  });

  const createAgentMut = useMutation({
    mutationFn: (data: { name: string; folder_id: string | null; model: string; provider: string }) =>
      createAgentFn({ data }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["dsFolders"] });
      queryClient.invalidateQueries({ queryKey: ["dsAgents"] });
      toast.success("Agente criado com sucesso!");
      if (res?.agent?.id) {
        navigate({ to: "/ds-agente/$agentId", params: { agentId: res.agent.id } });
      }
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar agente"),
  });

  const deleteAgentMut = useMutation({
    mutationFn: (id: string) => deleteAgentFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsFolders"] });
      queryClient.invalidateQueries({ queryKey: ["dsAgents"] });
      toast.success("Agente excluído.");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir agente"),
  });

  const moveAgentMut = useMutation({
    mutationFn: (data: { id: string; folderId: string | null }) => moveAgentFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsFolders"] });
      queryClient.invalidateQueries({ queryKey: ["dsAgents"] });
      toast.success("Agente movido com sucesso.");
    },
  });

  usePageHeader({
    title: "DS Agente",
    subtitle: "Gestão inteligente de agentes virtuais para automação de conversas.",
  });

  const folders = foldersQuery.data?.folders || [];
  const unassignedCount = foldersQuery.data?.unassigned_count || 0;
  const currentAgents = agentsQuery.data?.agents || [];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 bg-background text-foreground min-h-full">
      {selectedFolderId === "overview" ? (
        <FolderGrid
          folders={folders}
          unassignedCount={unassignedCount}
          onSelectFolder={(folderId, folderName) => {
            setSelectedFolderId(folderId);
            setSelectedFolderName(folderName);
          }}
          onCreateFolder={(name) => createFolderMut.mutate(name)}
          onOpenCreateAgentModal={() => setIsCreateAgentModalOpen(true)}
          onDeleteFolder={(id) => deleteFolderMut.mutate(id)}
          onDropAgentToFolder={(agentId, folderId) => moveAgentMut.mutate({ id: agentId, folderId })}
        />
      ) : (
        <AgentCardList
          folderName={selectedFolderName}
          folderId={selectedFolderId}
          agents={currentAgents}
          onBackToFolders={() => setSelectedFolderId("overview")}
          onSelectAgent={(agentId) => navigate({ to: "/ds-agente/$agentId", params: { agentId } })}
          onOpenCreateAgentModal={() => setIsCreateAgentModalOpen(true)}
          onDeleteAgent={(id) => deleteAgentMut.mutate(id)}
          onDropRemoveFromFolder={(agentId) => moveAgentMut.mutate({ id: agentId, folderId: null })}
        />
      )}

      <CreateAgentModal
        isOpen={isCreateAgentModalOpen}
        onClose={() => setIsCreateAgentModalOpen(false)}
        onCreateAgent={(data) => createAgentMut.mutate(data)}
        folders={folders}
        defaultFolderId={selectedFolderId === "overview" || selectedFolderId === "unassigned" ? null : selectedFolderId}
      />
    </div>
  );
}

// @ts-ignore
export const Route = createFileRoute("/_app/ds-agente/")({
  component: DsAgenteMainPage,
});
