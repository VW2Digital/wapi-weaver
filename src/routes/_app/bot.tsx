import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  BookOpen,
  Sparkles,
  Plus,
  ArrowLeft,
  FileText,
  Copy,
  X,
  Zap,
  Play,
  Send,
  RefreshCw,
  UserCheck,
  Bot,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getBotSettings,
  updateBotPauseTimeout,
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

function BotPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getBotSettings);
  const updatePauseTimeoutFn = useServerFn(updateBotPauseTimeout);
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
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
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
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      queryClient.invalidateQueries({ queryKey: ["botSettings", selectedChannel] });
      if (res?.warning) toast.warning(res.warning);
      else toast.success("Status atualizado");
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

  const updatePauseTimeout = useMutation({
    mutationFn: async (minutes: number) => {
      const res = await updatePauseTimeoutFn({
        data: { minutes, channel: selectedChannel },
      });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSettings", selectedChannel] });
      toast.success("Tempo de retomada automática atualizado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar tempo de retomada"),
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
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["botSteps", selectedChannel, activeFlowId] });
      queryClient.invalidateQueries({ queryKey: ["botFlows"] });
      if (res?.warning) toast.warning(res.warning);
      else toast.success("Fluxo salvo no banco de dados com sucesso!");
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

  const handleExportJson = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(steps, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `fluxo-bot-${activeFlowId || "export"}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Fluxo exportado em JSON!");
    } catch (e) {
      toast.error("Erro ao exportar JSON.");
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setSteps(json);
          setSelectedStep(null);
          toast.success("Fluxo importado do JSON com sucesso!");
        } else {
          toast.error("Arquivo JSON deve conter um array de passos.");
        }
      } catch (err) {
        toast.error("Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
  };

  const flowsList = flowsQuery.data?.flows || [];
  const pauseTimeoutMinutes = Number(
    (settingsQuery.data as any)?.settings?.pause_timeout_minutes ?? 60,
  );

  const filteredTemplates = BOT_TEMPLATES.filter((t) => {
    if (templateFilter === "todos") return true;
    return t.category === templateFilter;
  });

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

          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Retomar após intervenção humana</Label>
              <Select
                value={String(pauseTimeoutMinutes)}
                onValueChange={(value) => updatePauseTimeout.mutate(Number(value))}
                disabled={settingsQuery.isLoading || updatePauseTimeout.isPending}
              >
                <SelectTrigger className="w-44 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="480">8 horas</SelectItem>
                  <SelectItem value="1440">24 horas</SelectItem>
                </SelectContent>
              </Select>
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

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsSimulatorOpen(true)}
            variant="outline"
            size="sm"
            className="border-border bg-background text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Play className="w-4 h-4 mr-1.5 text-emerald-500" />
            Simular Fluxo
          </Button>

          <Button
            onClick={() => saveBatch.mutate(steps)}
            disabled={saveBatch.isPending}
            className="bg-brand-gradient text-white font-bold shadow-md hover:opacity-95"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>

          <Button
            onClick={() => setCurrentView("list")}
            variant="outline"
            size="sm"
            className="border-border bg-background text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar para Fluxos
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
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
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

      {/* SIMULADOR MODAL */}
      <BotSimulatorModal
        open={isSimulatorOpen}
        onOpenChange={setIsSimulatorOpen}
        steps={steps}
        agentName={profileQuery.data?.display_name || profileQuery.data?.full_name || "Assistente Virtual"}
      />
    </div>
  );
}

function BotSimulatorModal({
  open,
  onOpenChange,
  steps,
  agentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: any[];
  agentName: string;
}) {
  const [messages, setMessages] = useState<Array<{ sender: "bot" | "user"; text?: string; step?: any }>>([]);
  const [inputText, setInputText] = useState("");
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [isHandoff, setIsHandoff] = useState(false);

  const startSimulator = () => {
    setIsHandoff(false);
    const startStep = steps.find((s) => s.trigger_type === "start") || steps[0];
    if (startStep) {
      setMessages([{ sender: "bot", step: startStep }]);
      setCurrentStepId(startStep.next_step_id || null);
      if (startStep.next_step_id === "-999") setIsHandoff(true);
    } else {
      setMessages([{ sender: "bot", text: "Nenhum passo de início configurado no fluxo." }]);
    }
  };

  useEffect(() => {
    if (open) {
      startSimulator();
    }
  }, [open, steps]);

  const normalize = (str: string) =>
    String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const handleSendMessage = (textToSend?: string, customStepId?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text && !customStepId) return;

    if (text) {
      setMessages((prev) => [...prev, { sender: "user", text }]);
      setInputText("");
    }

    if (isHandoff) return;

    let targetStep: any = null;

    if (customStepId) {
      const cleanId = customStepId.replace("step:", "").split(":")[0];
      if (cleanId === "-999") {
        setIsHandoff(true);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Atendimento transferido para um operador humano." },
        ]);
        return;
      }
      targetStep = steps.find((s) => s.id === cleanId);
    } else {
      const normText = normalize(text);

      // 1. Check if last displayed message has interactive buttons/options matching text
      const lastBotMessage = [...messages].reverse().find((m) => m.sender === "bot" && m.step);
      if (lastBotMessage?.step?.buttons_config) {
        try {
          const config = typeof lastBotMessage.step.buttons_config === "string"
            ? JSON.parse(lastBotMessage.step.buttons_config)
            : lastBotMessage.step.buttons_config;

          const buttons = config?.action?.buttons || [];
          for (const btn of buttons) {
            const title = normalize(btn.reply?.title || "");
            const id = btn.reply?.id || "";
            if (title === normText || id === text || normText.includes(title)) {
              const cleanId = id.replace("step:", "").split(":")[0];
              if (cleanId === "-999") {
                setIsHandoff(true);
                setMessages((prev) => [
                  ...prev,
                  { sender: "bot", text: "Atendimento transferido para um operador humano." },
                ]);
                return;
              }
              targetStep = steps.find((s) => s.id === cleanId);
              break;
            }
          }

          if (!targetStep && config?.action?.sections) {
            for (const sec of config.action.sections) {
              for (const row of sec.rows || []) {
                const title = normalize(row.title || "");
                const id = row.id || "";
                if (title === normText || id === text || normText.includes(title)) {
                  const cleanId = id.replace("step:", "").split(":")[0];
                  if (cleanId === "-999") {
                    setIsHandoff(true);
                    setMessages((prev) => [
                      ...prev,
                      { sender: "bot", text: "Atendimento transferido para um operador humano." },
                    ]);
                    return;
                  }
                  targetStep = steps.find((s) => s.id === cleanId);
                  break;
                }
              }
            }
          }
        } catch (e) {
          // ignore json parse error
        }
      }

      // 2. Check currentStepId if present
      if (!targetStep && currentStepId) {
        if (currentStepId === "-999") {
          setIsHandoff(true);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "Atendimento transferido para um operador humano." },
          ]);
          return;
        }
        targetStep = steps.find((s) => s.id === currentStepId);
      }

      // 3. Check Keyword match
      if (!targetStep) {
        targetStep = steps.find((s) => {
          if (s.trigger_type !== "keyword") return false;
          const val = normalize(s.trigger_value || "");
          if (!val) return false;
          const keywords = val.split(/[,;\n]/).map((k) => normalize(k));
          return keywords.some((kw) => kw && (normText === kw || normText.includes(kw) || kw.includes(normText)));
        });
      }

      // 4. Greeting / Start Fallback (e.g. "oi", "olá", "menu", "início")
      if (!targetStep) {
        const greetings = ["oi", "ola", "olá", "hello", "hi", "menu", "inicio", "início", "bom dia", "boa tarde", "boa noite"];
        if (greetings.includes(normText) || normText.length <= 4) {
          targetStep = steps.find((s) => s.trigger_type === "start") || steps[0];
        }
      }
    }

    if (targetStep) {
      setTimeout(() => {
        setMessages((prev) => [...prev, { sender: "bot", step: targetStep }]);
        const nextId = targetStep.next_step_id || null;
        setCurrentStepId(nextId);
        if (nextId === "-999" || targetStep.message_type === "transfer_chat") {
          setIsHandoff(true);
        }
      }, 400);
    } else {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Nenhum passo correspondente encontrado para essa resposta." },
        ]);
      }, 400);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-4 bg-emerald-700 text-white flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white">{agentName}</DialogTitle>
              <div className="text-[11px] text-emerald-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                Simulador de Bot em Tempo Real
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={startSimulator}
            className="text-white hover:bg-white/10 h-8 w-8"
            title="Reiniciar Simulação"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* MESSAGES AREA */}
        <div className="p-4 h-[380px] overflow-y-auto bg-muted/20 space-y-3 font-sans text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl shadow-xs space-y-2 ${
                  m.sender === "user"
                    ? "bg-emerald-600 text-white rounded-br-none"
                    : "bg-card border border-border text-card-foreground rounded-bl-none"
                }`}
              >
                {m.text && <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                {m.step && (
                  <div className="space-y-2">
                    {m.step.media_url && (
                      <img
                        src={m.step.media_url}
                        alt="Mídia"
                        className="rounded-lg max-h-36 w-full object-cover"
                      />
                    )}
                    {m.step.message_content && (
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {m.step.message_content}
                      </p>
                    )}
                    {m.step.footer_text && (
                      <p className="text-[10px] text-muted-foreground border-t pt-1">
                        {m.step.footer_text}
                      </p>
                    )}

                    {/* Render Interactive Buttons, Lists, Dynamic Buttons, Image Buttons, and CTA Links */}
                    {m.step && m.step.buttons_config && (
                      <div className="pt-2 space-y-1.5 border-t border-border/40">
                        {(() => {
                          try {
                            const config =
                              typeof m.step.buttons_config === "string"
                                ? JSON.parse(m.step.buttons_config)
                                : m.step.buttons_config;

                            const isListType =
                              m.step.message_type === "list" ||
                              config?.sections ||
                              config?.action?.sections;
                            const isButtonType =
                              m.step.message_type === "buttons" ||
                              m.step.message_type === "dynamic_buttons" ||
                              m.step.message_type === "image_buttons" ||
                              config?.action?.buttons;

                            // Render List Sections & Rows
                            if (isListType) {
                              const sections = config?.sections || config?.action?.sections || [];
                              return (
                                <div className="space-y-2">
                                  {config?.button && (
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                      📋 {config.button}
                                    </div>
                                  )}
                                  {sections.map((sec: any, sIdx: number) => (
                                    <div key={sIdx} className="space-y-1">
                                      {sec.title && (
                                        <div className="text-[10px] font-semibold text-muted-foreground px-1">
                                          {sec.title}
                                        </div>
                                      )}
                                      {(sec.rows || []).map((row: any, rIdx: number) => (
                                        <button
                                          key={rIdx}
                                          onClick={() =>
                                            handleSendMessage(
                                              row.title || `Opção ${rIdx + 1}`,
                                              row.id,
                                            )
                                          }
                                          className="w-full text-left p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-foreground transition-colors group"
                                        >
                                          <div className="font-bold text-xs group-hover:text-primary">
                                            {row.title}
                                          </div>
                                          {row.description && (
                                            <div className="text-[10px] text-muted-foreground">
                                              {row.description}
                                            </div>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            // Render Reply / Dynamic / Image Buttons
                            if (isButtonType) {
                              const btns = config?.action?.buttons || config?.buttons || [];
                              return (
                                <div className="space-y-1.5">
                                  {btns.map((b: any, bIdx: number) => (
                                    <button
                                      key={bIdx}
                                      onClick={() =>
                                        handleSendMessage(
                                          b.reply?.title || b.title || `Opção ${bIdx + 1}`,
                                          b.reply?.id || b.id,
                                        )
                                      }
                                      className="w-full py-1.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-center text-xs transition-colors"
                                    >
                                      {b.reply?.title || b.title || `Opção ${bIdx + 1}`}
                                    </button>
                                  ))}
                                </div>
                              );
                            }

                            // Render CTA URL Link Button
                            if (m.step.message_type === "cta_url" || config?.url) {
                              return (
                                <a
                                  href={config.url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full block py-1.5 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-center text-xs transition-colors"
                                >
                                  🔗 {config.displayText || config.title || "Acessar Link"}
                                </a>
                              );
                            }

                            return null;
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isHandoff && (
            <div className="flex justify-center my-2">
              <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Transferido para Atendimento Humano
              </span>
            </div>
          )}
        </div>

        {/* INPUT FOOTER */}
        <div className="p-3 border-t border-border bg-card flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e: any) => setInputText(e.target.value)}
            onKeyDown={(e: any) => e.key === "Enter" && handleSendMessage()}
            placeholder={isHandoff ? "Bot pausado para este chat..." : "Digite uma mensagem..."}
            disabled={isHandoff}
            className="text-xs bg-background"
          />
          <Button
            size="icon"
            onClick={() => handleSendMessage()}
            disabled={isHandoff || !inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-9 w-9"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// @ts-ignore
export const Route = createFileRoute("/_app/bot")({
  component: BotPage,
});
