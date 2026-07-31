import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Sparkles, FileCheck, Wrench, MessageSquare, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { TabTraining } from "@/components/ds-agent/TabTraining";
import { TabKnowledge } from "@/components/ds-agent/TabKnowledge";
import { TabTools } from "@/components/ds-agent/TabTools";
import { TabTestChat } from "@/components/ds-agent/TabTestChat";
import { TabUsageReport } from "@/components/ds-agent/TabUsageReport";
import {
  getDsAgentDetail,
  updateDsAgent,
  addDsKnowledgeFile,
  deleteDsKnowledgeFile,
  addDsKnowledgeLink,
  deleteDsKnowledgeLink,
  updateDsTool,
  saveDsCalendarAvailability,
  createDsFollowup,
  deleteDsFollowup,
  testDsAgentChat,
  getDsAgentUsageReport,
} from "@/lib/ds-agent.functions";
import { toast } from "sonner";

// @ts-ignore
export const Route = createFileRoute("/_app/ds-agente/$agentId")({
  component: DsAgentEditorPage,
});

function DsAgentEditorPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getDetailFn = useServerFn(getDsAgentDetail);
  const updateAgentFn = useServerFn(updateDsAgent);
  const addFileFn = useServerFn(addDsKnowledgeFile);
  const deleteFileFn = useServerFn(deleteDsKnowledgeFile);
  const addLinkFn = useServerFn(addDsKnowledgeLink);
  const deleteLinkFn = useServerFn(deleteDsKnowledgeLink);
  const updateToolFn = useServerFn(updateDsTool);
  const saveAvailFn = useServerFn(saveDsCalendarAvailability);
  const createFollowupFn = useServerFn(createDsFollowup);
  const deleteFollowupFn = useServerFn(deleteDsFollowup);
  const testChatFn = useServerFn(testDsAgentChat);
  const getUsageFn = useServerFn(getDsAgentUsageReport);

  const [activeTab, setActiveTab] = useState<"treinamento" | "conhecimento" | "ferramentas" | "teste" | "uso">("treinamento");
  const [localAgentData, setLocalAgentData] = useState<any>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Queries
  const agentQuery = useQuery({
    queryKey: ["dsAgentDetail", agentId],
    queryFn: () => getDetailFn({ data: { id: agentId } }),
  });

  const usageQuery = useQuery({
    queryKey: ["dsAgentUsage", agentId],
    queryFn: () => getUsageFn({ data: { agentId, range: "30d" } }),
    enabled: activeTab === "uso",
  });

  useEffect(() => {
    if (agentQuery.data?.agent) {
      setLocalAgentData(agentQuery.data.agent);
    }
  }, [agentQuery.data]);

  // Mutations
  const updateAgentMut = useMutation({
    mutationFn: () => updateAgentFn({ data: { id: agentId, updates: localAgentData } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      setHasUnsavedChanges(false);
      toast.success("Alterações salvas com sucesso!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar alterações"),
  });

  const addFileMut = useMutation({
    mutationFn: (data: { file_name: string; file_size_kb: number; page_count: number }) =>
      addFileFn({ data: { agent_id: agentId, ...data } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Documento adicionado.");
    },
  });

  const deleteFileMut = useMutation({
    mutationFn: (id: string) => deleteFileFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Documento removido.");
    },
  });

  const addLinkMut = useMutation({
    mutationFn: (url: string) => addLinkFn({ data: { agent_id: agentId, url } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Link adicionado.");
    },
  });

  const deleteLinkMut = useMutation({
    mutationFn: (id: string) => deleteLinkFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Link removido.");
    },
  });

  const updateToolMut = useMutation({
    mutationFn: (data: { tool_key: string; enabled: boolean; config?: any }) =>
      updateToolFn({ data: { agent_id: agentId, ...data } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Ferramenta atualizada.");
    },
  });

  const saveAvailMut = useMutation({
    mutationFn: (availability: any[]) => saveAvailFn({ data: { agent_id: agentId, availability } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Disponibilidade salva.");
    },
  });

  const createFollowupMut = useMutation({
    mutationFn: (data: any) => createFollowupFn({ data: { agent_id: agentId, ...data } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Follow-up adicionado.");
    },
  });

  const deleteFollowupMut = useMutation({
    mutationFn: (id: string) => deleteFollowupFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dsAgentDetail", agentId] });
      toast.success("Follow-up removido.");
    },
  });

  const handleFieldChange = (field: string, value: any) => {
    setLocalAgentData((prev: any) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  usePageHeader({
    title: `Editar Agente: ${localAgentData.name || ""}`,
    subtitle: "Treinamento, ferramentas, simulação e relatórios de uso.",
  });

  if (agentQuery.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const agentDetail = agentQuery.data;
  if (!agentDetail?.ok) {
    return (
      <div className="p-8 text-center text-destructive bg-background min-h-dvh">
        <p>Agente não encontrado ou sem acesso.</p>
        <Button onClick={() => navigate({ to: "/ds-agente" })} className="mt-4">
          Voltar para agentes
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "treinamento", label: "Treinamento", icon: Sparkles },
    { id: "conhecimento", label: "Conhecimento", icon: FileCheck },
    { id: "ferramentas", label: "Ferramentas", icon: Wrench },
    { id: "teste", label: "Teste", icon: MessageSquare },
    { id: "uso", label: "Uso", icon: BarChart2 },
  ] as const;

  return (
    <div className="flex-1 bg-background text-foreground min-h-dvh p-4 md:p-8 space-y-6">
      {/* Header with Title, 5 Tabs and Save Button */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/ds-agente" })}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-foreground">Editar Agente</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {localAgentData.name || "Sem Nome"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localAgentData.provider || "OpenAI Padrão"} • {localAgentData.model || "gpt-4o-mini"}
            </p>
          </div>
        </div>

        {/* 5 Tabs Header */}
        <div className="flex rounded-xl border border-border bg-card p-1 overflow-x-auto max-w-full shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bliv Primary Brand Gradient Always Visible Save Button */}
        <Button
          onClick={() => updateAgentMut.mutate()}
          disabled={updateAgentMut.isPending}
          className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95 shrink-0"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateAgentMut.isPending ? "Salvando..." : "Salvar Agente"}
        </Button>
      </div>

      {/* Tab Content Display */}
      {activeTab === "treinamento" && (
        <TabTraining
          agentData={localAgentData}
          onChangeField={handleFieldChange}
          followups={agentDetail.followups || []}
          onAddFollowup={(f) => createFollowupMut.mutate(f)}
          onDeleteFollowup={(id) => deleteFollowupMut.mutate(id)}
        />
      )}

      {activeTab === "conhecimento" && (
        <TabKnowledge
          files={agentDetail.knowledge?.files || []}
          links={agentDetail.knowledge?.links || []}
          onUploadFile={(fileName, fileSizeKb, pageCount) =>
            addFileMut.mutate({ file_name: fileName, file_size_kb: fileSizeKb, page_count: pageCount })
          }
          onDeleteFile={(id) => deleteFileMut.mutate(id)}
          onAddLink={(url) => addLinkMut.mutate(url)}
          onDeleteLink={(id) => deleteLinkMut.mutate(id)}
        />
      )}

      {activeTab === "ferramentas" && (
        <TabTools
          tools={agentDetail.tools || []}
          availability={agentDetail.availability || []}
          onToggleTool={(tool_key, enabled, config) => updateToolMut.mutate({ tool_key, enabled, config })}
          onSaveAvailability={(avail) => saveAvailMut.mutate(avail)}
        />
      )}

      {activeTab === "teste" && (
        <TabTestChat
          agentName={localAgentData.name}
          agentId={agentId}
          onSendTestMessage={async (msg) => {
            const res = await testChatFn({ data: { agent_id: agentId, message: msg } });
            return { reply: res.reply };
          }}
        />
      )}

      {activeTab === "uso" && (
        <TabUsageReport
          usageData={usageQuery.data}
          onRefresh={() => usageQuery.refetch()}
        />
      )}
    </div>
  );
}
