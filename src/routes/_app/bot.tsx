import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Power,
  BookOpen,
  Sparkles,
  Plus,
  ArrowLeft,
  FileText,
  Copy,
  X,
  Zap,
} from "lucide-react";
import {
  getBotSettings,
  toggleBotStatus,
  listBotSteps,
  saveBotStepsBatch,
  listBotFlows,
  createBotFlow,
  toggleBotFlowStatus,
  duplicateBotFlow,
  deleteBotFlow,
} from "@/lib/botflow.functions";
import { getProfile } from "@/lib/profile.functions";
import { toast } from "sonner";
import { BotFlowCanvas } from "@/components/bot-flow/BotFlowCanvas";
import { StepInspector } from "@/components/bot-flow/StepInspector";
import { BOT_TEMPLATES, mapTemplateSteps } from "@/lib/bot-templates";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BotComponentsSidebar,
  ComponentItem,
  TriggerItem,
} from "@/components/bot-flow/BotComponentsSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// @ts-ignore
export const Route = createFileRoute("/_app/bot")({
  component: BotPage,
});

function BotPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getBotSettings);
  const toggleStatusFn = useServerFn(toggleBotStatus);
  const listStepsFn = useServerFn(listBotSteps);
  const saveStepsBatchFn = useServerFn(saveBotStepsBatch);
  const getProfileFn = useServerFn(getProfile);

  const listFlowsFn = useServerFn(listBotFlows);
  const createFlowFn = useServerFn(createBotFlow);
  const toggleFlowStatusFn = useServerFn(toggleBotFlowStatus);
  const duplicateFlowFn = useServerFn(duplicateBotFlow);
  const deleteFlowFn = useServerFn(deleteBotFlow);

  const [currentView, setCurrentView] = useState<"list" | "canvas">("list");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("whatsapp");
  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<string>("todos");

  // Queries
  const flowsQuery = useQuery({
    queryKey: ["botFlows"],
    queryFn: () => listFlowsFn(),
  });

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
  });

  const settingsQuery = useQuery({
    queryKey: ["botSettings", selectedChannel],
    queryFn: () => getSettingsFn({ data: { channel: selectedChannel } }),
  });

  const stepsQuery = useQuery({
    queryKey: ["botSteps", selectedChannel, activeFlowId],
    queryFn: () => listStepsFn({ data: { channel: selectedChannel, flowId: activeFlowId } }),
    enabled: currentView === "canvas",
  });

  useEffect(() => {
    if (stepsQuery.data) {
      setSteps(stepsQuery.data);
    }
  }, [stepsQuery.data]);

  usePageHeader({});

  // Flow Mutations
  const createFlowMut = useMutation({
    mutationFn: () => createFlowFn({ data: { name: "Novo Fluxo" } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      if (res.flow?.id) {
        setActiveFlowId(res.flow.id);
        setCurrentView("canvas");
      }
      toast.success("Novo fluxo criado com sucesso!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar fluxo"),
  });

  const toggleFlowStatusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleFlowStatusFn({ data: { id, isActive } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar status"),
  });

  const duplicateFlowMut = useMutation({
    mutationFn: (id: string) => duplicateFlowFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      toast.success("Fluxo duplicado com sucesso!");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao duplicar fluxo"),
  });

  const deleteFlowMut = useMutation({
    mutationFn: (id: string) => deleteFlowFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      toast.success("Fluxo removido.");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao deletar fluxo"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await toggleStatusFn({ data: { isActive, channel: selectedChannel } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSettings", selectedChannel] });
      toast.success("Status do bot atualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveBatch = useMutation({
    mutationFn: async (payload: any[]) => {
      for (const step of payload) {
        if (step.trigger_type === "webhook") {
          let conditions: any[] = [];
          try {
            conditions =
              typeof step.trigger_value === "string"
                ? JSON.parse(step.trigger_value || "[]")
                : step.trigger_value || [];
          } catch (e) {
            conditions = [];
          }
          if (!Array.isArray(conditions) || conditions.length === 0) {
            throw new Error(`O Passo #${step.step_order} (Gatilho por Webhook) precisa de pelo menos 1 condição.`);
          }
          for (const cond of conditions) {
            if (!cond.field || !cond.field.trim()) {
              throw new Error(`Condição no Passo #${step.step_order} tem campo de matching vazio.`);
            }
            if (cond.operator !== "exists" && (!cond.value || !cond.value.trim())) {
              throw new Error(`Condição no Passo #${step.step_order} para o campo "${cond.field}" precisa de um valor.`);
            }
          }
        }
      }

      const res = await saveStepsBatchFn({
        data: { channel: selectedChannel, flowId: activeFlowId, steps: payload },
      });
      if (!res.ok) throw new Error(res.error || "Erro ao salvar o fluxo");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSteps", selectedChannel, activeFlowId] });
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      toast.success("Fluxo salvo no banco de dados com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Erro desconhecido ao salvar"),
  });

  const handleAddComponent = (item: ComponentItem) => {
    const newStep = {
      id: crypto.randomUUID(),
      step_order: steps.length + 1,
      trigger_type: steps.length === 0 ? "start" : "keyword",
      trigger_value: "",
      message_type: item.type,
      message_content: item.title,
      position_x: 250 + (steps.length % 3) * 60,
      position_y: 100 + steps.length * 90,
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep);
    toast.success(`Componente "${item.title}" adicionado.`);
  };

  const handleSelectTrigger = (trigger: TriggerItem) => {
    const newTriggerStep = {
      id: crypto.randomUUID(),
      step_order: steps.length + 1,
      trigger_type: trigger.type,
      trigger_value: trigger.title,
      message_type: "text",
      message_content: `Gatilho: ${trigger.title}`,
      position_x: 100,
      position_y: 80,
    };
    setSteps([newTriggerStep, ...steps]);
    setSelectedStep(newTriggerStep);
    toast.success(`Gatilho "${trigger.title}" adicionado.`);
  };

  const handleUpdateStep = (field: string, value: any) => {
    if (!selectedStep) return;
    const updated = { ...selectedStep, [field]: value };
    setSelectedStep(updated);
    setSteps(steps.map((s) => (s.id === selectedStep.id ? updated : s)));
  };

  const handleDeleteStep = () => {
    if (!selectedStep) return;
    setSteps(steps.filter((s) => s.id !== selectedStep.id));
    setSelectedStep(null);
  };

  const isSettingsActive =
    (settingsQuery.data as any)?.settings?.is_active ||
    (settingsQuery.data as any)?.is_active ||
    false;

  const filteredTemplates = BOT_TEMPLATES.filter((t) => {
    if (templateFilter === "todos") return true;
    return t.category === templateFilter;
  });

  const flowsList = flowsQuery.data?.flows || [];

  // ============================================================================
  // VIEW 1: SEÇÃO INICIAL "FLUXOS DE AUTOMAÇÃO" (LISTA DE FLUXOS)
  // ============================================================================
  if (currentView === "list") {
    return (
      <div className="flex-1 bg-background text-foreground p-6 space-y-6 min-h-screen">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              Fluxos de Automação
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Gerencie e crie novos fluxos interativos de automação para atendimento e vendas.
            </p>
          </div>

          <Button
            onClick={() => createFlowMut.mutate()}
            disabled={createFlowMut.isPending}
            className="bg-brand-gradient text-white font-bold shadow-md hover:opacity-95 px-5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar
          </Button>
        </div>

        {/* Table of Flows */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border hover:bg-muted/40">
                <TableHead className="text-muted-foreground font-semibold">Nome</TableHead>
                <TableHead className="text-center text-muted-foreground font-semibold w-28">Gatilhos</TableHead>
                <TableHead className="text-center text-muted-foreground font-semibold w-28">Ações</TableHead>
                <TableHead className="text-center text-muted-foreground font-semibold w-28">Status</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Última Execução</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando fluxos...
                  </TableCell>
                </TableRow>
              ) : flowsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum fluxo encontrado. Clique em "Adicionar" para criar o primeiro.
                  </TableCell>
                </TableRow>
              ) : (
                flowsList.map((flow: any) => (
                  <TableRow key={flow.id} className="border-border hover:bg-muted/20 transition-colors">
                    {/* Nome do Fluxo */}
                    <TableCell
                      onClick={() => {
                        setActiveFlowId(flow.id);
                        setCurrentView("canvas");
                      }}
                      className="font-display font-bold text-foreground hover:text-primary cursor-pointer"
                    >
                      {flow.name}
                    </TableCell>

                    {/* Gatilhos (Badge Verde) */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                        {flow.triggers_count || 1}
                      </div>
                    </TableCell>

                    {/* Ações (Badge Rosa) */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold">
                        {flow.actions_count || 1}
                      </div>
                    </TableCell>

                    {/* Status Toggle */}
                    <TableCell className="text-center">
                      <Switch
                        checked={flow.is_active}
                        onCheckedChange={(val) =>
                          toggleFlowStatusMut.mutate({ id: flow.id, isActive: val })
                        }
                      />
                    </TableCell>

                    {/* Última Execução */}
                    <TableCell className="text-xs text-muted-foreground">
                      {flow.last_executed_at
                        ? new Date(flow.last_executed_at).toLocaleString("pt-BR")
                        : "Nunca"}
                    </TableCell>

                    {/* Row Actions Icons */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 text-muted-foreground">
                        <button
                          title="Editar Fluxo"
                          onClick={() => {
                            setActiveFlowId(flow.id);
                            setCurrentView("canvas");
                          }}
                          className="p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                        </button>

                        <button
                          title="Duplicar Fluxo"
                          onClick={() => duplicateFlowMut.mutate(flow.id)}
                          className="p-1.5 rounded hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>

                        <button
                          title="Deletar Fluxo"
                          onClick={() => deleteFlowMut.mutate(flow.id)}
                          className="p-1.5 rounded hover:bg-muted hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: CONSTRUTOR DE FLUXO (CANVAS EDITOR)
  // ============================================================================
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* TOP HEADER */}
      <div className="flex-none px-6 py-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setCurrentView("list")}
            variant="outline"
            size="sm"
            className="border-border bg-background text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar para Fluxos
          </Button>

          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Construtor de Fluxo</h1>
            <p className="text-xs text-muted-foreground">Arraste e solte ações, gatilhos e controles de fluxo</p>
          </div>

          <Select
            value={selectedChannel}
            onValueChange={(val) => {
              setSelectedChannel(val);
              setSelectedStep(null);
            }}
          >
            <SelectTrigger className="w-48 ml-2 bg-background border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-xs">
              <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">Status do Bot</Label>
            <Switch checked={isSettingsActive} onCheckedChange={(c) => toggleStatus.mutate(c)} />
          </div>
          <Button
            onClick={() => saveBatch.mutate(steps)}
            disabled={saveBatch.isPending}
            className="bg-brand-gradient text-white font-bold shadow-md hover:opacity-95"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      {/* MAIN BUILDER AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* COMPONENTES SIDEBAR & ESCOLHER GATILHO */}
        <BotComponentsSidebar
          onAddComponent={handleAddComponent}
          onSelectTrigger={handleSelectTrigger}
          onOpenTemplates={() => setIsGalleryOpen(true)}
        />

        {/* CANVAS */}
        <div className="flex-1 relative bg-background">
          <BotFlowCanvas steps={steps} onStepsChange={setSteps} onNodeClick={setSelectedStep} />
        </div>

        {/* INSPECTOR */}
        {selectedStep && (
          <StepInspector
            selectedStep={selectedStep}
            handleUpdateStep={handleUpdateStep}
            handleDeleteStep={handleDeleteStep}
            steps={steps}
            agentName={
              profileQuery.data?.display_name || profileQuery.data?.full_name || "Atendente"
            }
            onClose={() => setSelectedStep(null)}
          />
        )}
      </div>

      {/* TEMPLATES GALLERY SHEET */}
      <Sheet open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <SheetContent className="w-full sm:max-w-md bg-card border-l border-border p-6 flex flex-col h-full gap-4 overflow-y-auto">
          <SheetHeader className="pb-2 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold font-display text-foreground">
                  Galeria de Templates de Bot
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Selecione um fluxo pronto para carregar no Canvas
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Category Tabs Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "todos", label: "Todos" },
              { id: "qualificacao", label: "Qualificação" },
              { id: "vendas", label: "Vendas" },
              { id: "suporte", label: "Suporte" },
              { id: "geral", label: "Geral" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setTemplateFilter(cat.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  templateFilter === cat.id
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-background text-muted-foreground border border-border hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Templates Grid */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="border border-border bg-background hover:border-primary/60 transition-all shadow-xs group"
              >
                <CardHeader className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold font-display text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      {template.name}
                    </CardTitle>
                    {template.badge && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                        {template.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                    {template.description}
                  </CardDescription>

                  <div className="pt-2 flex items-center justify-between border-t border-border/60">
                    <span className="text-[11px] text-muted-foreground">
                      {template.steps.length} blocos inclusos
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        try {
                          const newSteps = mapTemplateSteps(template.steps);
                          setSteps(newSteps);
                          setSelectedStep(null);
                          setIsGalleryOpen(false);
                          toast.success(`Template "${template.name}" carregado! Clique em Salvar.`);
                        } catch (e) {
                          toast.error("Erro ao carregar template.");
                          console.error(e);
                        }
                      }}
                      className="bg-brand-gradient text-white text-xs font-bold shadow-xs hover:opacity-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Usar Template
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
