import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  listFunnels,
  createFunnel,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  listOpportunities,
  createOpportunity,
  moveOpportunity,
  listOwners,
  getCRMStats,
} from "@/lib/crm.functions";
import { listContacts } from "@/lib/contacts.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { OpportunityModal } from "@/components/crm/OpportunityModal";
import {
  Plus,
  Search,
  Filter,
  Kanban,
  Table,
  Sparkles,
  TrendingUp,
  Award,
  DollarSign,
  AlertCircle,
  BarChart3,
  Calendar,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  AlertTriangle,
  MoreVertical,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FUNNEL_TEMPLATES, type FunnelTemplate } from "@/lib/funnel-templates";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#a855f7", // Purple
  "#eab308", // Yellow
  "#f97316", // Orange
  "#06b6d4", // Cyan
  "#22c55e", // Green
  "#ef4444", // Red
  "#64748b", // Gray
  "#f43f5e", // Rose
  "#6366f1", // Indigo
];

export const Route = createFileRoute("/_app/crm")({ component: CRMPage });

function CRMPage() {
  const qc = useQueryClient();

  // Server functions
  const fetchFunnels = useServerFn(listFunnels);
  const addFunnel = useServerFn(createFunnel);
  const fetchStages = useServerFn(listStages);
  const addStage = useServerFn(createStage);
  const updateStageFn = useServerFn(updateStage);
  const deleteStageFn = useServerFn(deleteStage);
  const reorderStagesFn = useServerFn(reorderStages);
  const fetchOpps = useServerFn(listOpportunities);
  const addOpp = useServerFn(createOpportunity);
  const moveOpp = useServerFn(moveOpportunity);
  const fetchOwners = useServerFn(listOwners);
  const fetchStats = useServerFn(getCRMStats);
  const fetchContacts = useServerFn(listContacts);

  // Queries
  const { data: funnels = [], isLoading: loadingFunnels } = useQuery({
    queryKey: ["funnels"],
    queryFn: () => fetchFunnels(),
  });

  // Active Funnel selection
  const [activeFunnelId, setActiveFunnelId] = useState<string>("");

  // Select first funnel as default when loaded
  const currentFunnel = useMemo(() => {
    if (funnels.length === 0) return null;
    if (activeFunnelId) {
      return funnels.find((f: any) => f.id === activeFunnelId) || funnels[0];
    }
    const def = funnels.find((f: any) => f.is_default) || funnels[0];
    return def;
  }, [funnels, activeFunnelId]);

  const activeId = currentFunnel?.id || "";

  // Set funnel selection
  const handleFunnelChange = (val: string) => {
    setActiveFunnelId(val);
  };

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["stages", activeId],
    queryFn: () => fetchStages({ data: { funnel_id: activeId } }),
    enabled: !!activeId,
    refetchInterval: 30_000,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: () => fetchOwners(),
    refetchInterval: 60_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-crm"],
    queryFn: () => fetchContacts(),
  });

  // Filters state
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "won" | "lost" | "paused" | "archived">(
    "open",
  );
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const { data: opps = [], isLoading: loadingOpps } = useQuery({
    queryKey: ["opportunities", activeId, viewMode, statusFilter, search],
    queryFn: () =>
      fetchOpps({
        data: {
          funnel_id: activeId,
          status: viewMode === "kanban" ? undefined : statusFilter,
          search: search || undefined,
          limit: 100,
        },
      }),
    enabled: !!activeId,
    refetchInterval: 30_000,
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["crm-stats", activeId],
    queryFn: () => fetchStats({ data: { funnel_id: activeId } }),
    enabled: !!activeId,
    refetchInterval: 30_000,
  });

  // Filter opportunities locally for secondary attributes
  const filteredOpps = useMemo(() => {
    return opps.filter((o: any) => {
      if (priorityFilter !== "all" && o.priority !== priorityFilter) return false;
      if (tempFilter !== "all" && o.temperature !== tempFilter) return false;
      return true;
    });
  }, [opps, priorityFilter, tempFilter]);

  // Stage management state
  const [stageManagerOpen, setStageManagerOpen] = useState(false);
  const [stageView, setStageView] = useState<"list" | "form">("list");
  const [editingStage, setEditingStage] = useState<any | null>(null);

  // Stage form state
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#3b82f6");
  const [stageProb, setStageProb] = useState(50);
  const [isWonStage, setIsWonStage] = useState(false);
  const [isLostStage, setIsLostStage] = useState(false);

  // Stage delete confirmation state
  const [stageToDelete, setStageToDelete] = useState<any | null>(null);
  const [migrationStageId, setMigrationStageId] = useState("");

  // Stage mutations
  const updateStageMutation = useMutation({
    mutationFn: (payload: { id: string; data: any }) => updateStageFn({ data: payload }),
    onSuccess: () => {
      toast.success("Etapa atualizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["stages", activeId] });
      setStageView("list");
      setEditingStage(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createStageMutation = useMutation({
    mutationFn: (payload: any) => addStage({ data: payload }),
    onSuccess: () => {
      toast.success("Etapa criada com sucesso!");
      qc.invalidateQueries({ queryKey: ["stages", activeId] });
      setStageView("list");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reorderStagesMutation = useMutation({
    mutationFn: (payload: any) => reorderStagesFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", activeId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (payload: { id: string; move_opportunities_to_stage_id?: string }) =>
      deleteStageFn({
        data: {
          id: payload.id,
          move_opportunities_to_stage_id: payload.move_opportunities_to_stage_id,
        },
      }),
    onSuccess: () => {
      toast.success("Etapa excluída!");
      setStageToDelete(null);
      setMigrationStageId("");
      qc.invalidateQueries({ queryKey: ["stages", activeId] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["crm-stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleOpenStageForm = (stage: any | null = null) => {
    if (stage) {
      setEditingStage(stage);
      setStageName(stage.name);
      setStageColor(stage.color || "#3b82f6");
      setStageProb(Number(stage.probability_percent) || 0);
      setIsWonStage(!!stage.is_won_stage);
      setIsLostStage(!!stage.is_lost_stage);
    } else {
      setEditingStage(null);
      setStageName("");
      setStageColor("#3b82f6");
      setStageProb(50);
      setIsWonStage(false);
      setIsLostStage(false);
    }
    setStageView("form");
    setStageManagerOpen(true);
  };

  const handleSaveStage = () => {
    if (!stageName.trim()) return;

    const payload = {
      funnel_id: activeId,
      name: stageName,
      color: stageColor,
      probability_percent: stageProb,
      is_won_stage: isWonStage,
      is_lost_stage: isLostStage,
      is_active: true,
      sort_order: editingStage ? editingStage.sort_order : stages.length + 1,
    };

    if (editingStage) {
      updateStageMutation.mutate({
        id: editingStage.id,
        data: payload,
      });
    } else {
      createStageMutation.mutate(payload);
    }
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const newStages = [...stages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    // Swap elements
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;

    // Map payload
    const payload = {
      funnel_id: activeId,
      stages: newStages.map((s, idx) => ({
        id: s.id,
        sort_order: idx + 1,
      })),
    };

    reorderStagesMutation.mutate(payload);
  };

  const handleDeleteStageClick = (stage: any) => {
    // Check if stage has opportunities
    const hasOpps = opps.some((o: any) => o.stage_id === stage.id);
    if (hasOpps) {
      setStageToDelete(stage);
      // set migration target stage to first other stage
      const otherStages = stages.filter((s: any) => s.id !== stage.id);
      setMigrationStageId(otherStages[0]?.id || "");
    } else {
      if (confirm(`Tem certeza que deseja excluir a etapa "${stage.name}"?`)) {
        deleteStageMutation.mutate({ id: stage.id });
      }
    }
  };

  const handleConfirmDeleteWithMigration = () => {
    if (!stageToDelete) return;
    deleteStageMutation.mutate({
      id: stageToDelete.id,
      move_opportunities_to_stage_id: migrationStageId || undefined,
    });
  };

  // Modals state
  const [newFunnelOpen, setNewFunnelOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [newFunnelDesc, setNewFunnelDesc] = useState("");

  const [newOppOpen, setNewOppOpen] = useState(false);
  const [newOppTitle, setNewOppTitle] = useState("");
  const [newOppValue, setNewOppValue] = useState(0);
  const [newOppStageId, setNewOppStageId] = useState("");
  const [newOppContactId, setNewOppContactId] = useState("");
  const [newOppOwnerId, setNewOppOwnerId] = useState("");
  const [newOppPriority, setNewOppPriority] = useState<"low" | "medium" | "high" | "urgent">(
    "medium",
  );
  const [newOppTemp, setNewOppTemp] = useState<"cold" | "warm" | "hot">("cold");

  const [selectedTemplate, setSelectedTemplate] = useState<FunnelTemplate | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  const handleOpenNewOppModal = (stageId?: string) => {
    setNewOppTitle("");
    setNewOppValue(0);
    setNewOppStageId(stageId || stages[0]?.id || "");
    setNewOppContactId("");
    setNewOppOwnerId("");
    setNewOppPriority("medium");
    setNewOppTemp("cold");
    setNewOppOpen(true);
  };

  // Mutations
  const funnelMutation = useMutation({
    mutationFn: () =>
      addFunnel({
        data: {
          name: newFunnelName,
          description: newFunnelDesc,
          is_default: funnels.length === 0,
          stages: selectedTemplate ? selectedTemplate.stages : undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        selectedTemplate
          ? `Funil "${newFunnelName}" criado com ${selectedTemplate.stages.length} etapas!`
          : "Funil de vendas criado!",
      );
      setNewFunnelOpen(false);
      setNewFunnelName("");
      setNewFunnelDesc("");
      setSelectedTemplate(null);
      qc.invalidateQueries({ queryKey: ["funnels"] });
      qc.invalidateQueries({ queryKey: ["stages"] });
      setActiveFunnelId(res.id);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const oppMutation = useMutation({
    mutationFn: () =>
      addOpp({
        data: {
          title: newOppTitle,
          value: newOppValue,
          funnel_id: activeId,
          stage_id: newOppStageId || stages[0]?.id,
          primary_contact_id: newOppContactId || null,
          owner_user_id: newOppOwnerId || null,
          priority: newOppPriority,
          temperature: newOppTemp,
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade comercial criada!");
      setNewOppOpen(false);
      setNewOppTitle("");
      setNewOppValue(0);
      setNewOppStageId("");
      setNewOppContactId("");
      setNewOppOwnerId("");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["crm-stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      toStageId,
      beforeOppId,
      afterOppId,
    }: {
      id: string;
      toStageId: string;
      beforeOppId?: string | null;
      afterOppId?: string | null;
    }) =>
      moveOpp({
        data: {
          id,
          to_stage_id: toStageId,
          before_opportunity_id: beforeOppId ?? null,
          after_opportunity_id: afterOppId ?? null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["crm-stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleMoveCard = (
    id: string,
    toStageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) => {
    moveMutation.mutate({ id, toStageId, beforeOppId, afterOppId });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  // Compute overall funnel values
  const totalOpenValue = useMemo(() => {
    const sum = filteredOpps.reduce((acc: number, o: any) => acc + (Number(o.value) || 0), 0);
    return sum;
  }, [filteredOpps]);

  const totalWonValue = useMemo(() => {
    const won = stats?.status_summary?.find((s: any) => s.status === "won");
    if (won?.total_value != null) {
      return Number(won.total_value) || 0;
    }
    return opps
      .filter((o: any) => o.status === "won")
      .reduce((acc: number, o: any) => acc + (Number(o.value) || 0), 0);
  }, [stats, opps]);

  const totalLostValue = useMemo(() => {
    const lost = stats?.status_summary?.find((s: any) => s.status === "lost");
    if (lost?.total_value != null) {
      return Number(lost.total_value) || 0;
    }
    return opps
      .filter((o: any) => o.status === "lost")
      .reduce((acc: number, o: any) => acc + (Number(o.value) || 0), 0);
  }, [stats, opps]);

  usePageHeader({
    title: "Kanban",
    action: (
      <div className="flex items-center gap-2">
        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Funnel Selector */}
          {funnels.length > 0 && (
            <Select value={activeId} onValueChange={handleFunnelChange}>
              <SelectTrigger className="w-[180px] h-8 px-3 rounded-full text-xs font-medium border-border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {funnels.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Manage Stages */}
          {funnels.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-full text-xs font-medium border-border gap-1.5 inline-flex items-center"
              onClick={() => {
                setStageManagerOpen(true);
                setStageView("list");
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Gerenciar Etapas</span>
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => setNewFunnelOpen(true)}
            className="h-8 px-3 rounded-full text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center"
          >
            Novo Funil
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenNewOppModal()}
            className="h-8 px-3 rounded-full text-xs font-medium gap-1.5 inline-flex items-center"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Oportunidade</span>
          </Button>
        </div>

        {/* Mobile Actions Dropdown */}
        <div className="flex md:hidden items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[200px] bg-white dark:bg-[#0c0a0f] border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
            >
              {funnels.length > 0 && (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer focus:bg-neutral-800 focus:text-neutral-100">
                      <Filter className="h-4 w-4" />
                      <span>Selecionar Funil</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="bg-white dark:bg-[#0c0a0f] border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200">
                        {funnels.map((f: any) => (
                          <DropdownMenuItem
                            key={f.id}
                            onClick={() => handleFunnelChange(f.id)}
                            className="flex items-center justify-between cursor-pointer focus:bg-neutral-800 focus:text-neutral-100"
                          >
                            <span>{f.name}</span>
                            {activeId === f.id && <Check className="h-4 w-4 text-violet-500" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator className="bg-neutral-800" />
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleOpenNewOppModal()}
                className="flex items-center gap-2 cursor-pointer focus:bg-neutral-800 focus:text-neutral-100"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Oportunidade</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setNewFunnelOpen(true)}
                className="flex items-center gap-2 cursor-pointer focus:bg-neutral-800 focus:text-neutral-100"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Funil</span>
              </DropdownMenuItem>
              {funnels.length > 0 && (
                <DropdownMenuItem
                  onClick={() => {
                    setStageManagerOpen(true);
                    setStageView("list");
                  }}
                  className="flex items-center gap-2 cursor-pointer focus:bg-neutral-800 focus:text-neutral-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Gerenciar Etapas</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Render dialogs outside of triggers */}
        <Dialog
          open={newFunnelOpen}
          onOpenChange={(open) => {
            setNewFunnelOpen(open);
            if (!open) {
              setSelectedTemplate(null);
              setNewFunnelName("");
              setNewFunnelDesc("");
            }
          }}
        >
          <DialogContent className="max-w-4xl bg-card border border-muted-foreground/15 rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>Criar Novo Funil de Vendas</span>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="templates" className="w-full my-3">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="templates" className="gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Templates Prontos</span>
                </TabsTrigger>
                <TabsTrigger value="custom" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Funil em Branco</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="templates" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Escolha um modelo de funil pré-configurado com as melhores práticas e etapas prontas para o seu negócio:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FUNNEL_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplate?.id === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => {
                          setSelectedTemplate(tmpl);
                          setNewFunnelName(tmpl.name);
                          setNewFunnelDesc(tmpl.description);
                        }}
                        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 relative flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                            : "border-border hover:border-primary/50 hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${tmpl.badgeColor}`}>
                              {tmpl.category}
                            </span>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                                <Check className="h-4 w-4" /> Selecionado
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                            {tmpl.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {tmpl.description}
                          </p>

                          <div className="mt-3 space-y-1">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              Etapas incluídas ({tmpl.stages.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {tmpl.stages.map((stg, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-muted/80 font-medium text-foreground"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: stg.color }}
                                  />
                                  {stg.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
                          <Button
                            size="sm"
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className="w-full text-xs font-medium"
                          >
                            {isSelected ? "Template Selecionado" : "Usar este Template"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedTemplate && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 mt-4 animate-in fade-in-50">
                    <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>Personalizar nome do funil</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome do Funil</Label>
                        <Input
                          value={newFunnelName}
                          onChange={(e) => setNewFunnelName(e.target.value)}
                          placeholder="Nome do seu funil..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Descrição (opcional)</Label>
                        <Input
                          value={newFunnelDesc}
                          onChange={(e) => setNewFunnelDesc(e.target.value)}
                          placeholder="Descrição..."
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Crie um funil do zero sem etapas pré-definidas. Você poderá adicionar e personalizar as etapas manualmente.
                </p>
                <div className="space-y-4 my-2 max-w-md">
                  <div className="space-y-1.5">
                    <Label>Nome do Funil</Label>
                    <Input
                      value={newFunnelName}
                      onChange={(e) => {
                        setSelectedTemplate(null);
                        setNewFunnelName(e.target.value);
                      }}
                      placeholder="Ex: Vendas Externas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Textarea
                      rows={3}
                      value={newFunnelDesc}
                      onChange={(e) => setNewFunnelDesc(e.target.value)}
                      placeholder="Descreva o propósito deste pipeline..."
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedTemplate ? (
                  <span>Criando com <strong>{selectedTemplate.stages.length} etapas</strong> pré-configuradas.</span>
                ) : (
                  <span>Sem etapas iniciais.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setNewFunnelOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => funnelMutation.mutate()}
                  disabled={!newFunnelName.trim() || funnelMutation.isPending}
                  className="bg-primary text-primary-foreground font-medium"
                >
                  {funnelMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                    </>
                  ) : selectedTemplate ? (
                    `Criar Funil (${selectedTemplate.stages.length} Etapas)`
                  ) : (
                    "Criar Funil"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newOppOpen} onOpenChange={setNewOppOpen}>
          <DialogContent
            className="sm:max-w-2xl bg-card border border-muted-foreground/15 rounded-xl p-6"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Nova Oportunidade Comercial</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 my-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2 min-w-0">
                <Label>Título / Nome do Deal</Label>
                <Input
                  value={newOppTitle}
                  onChange={(e) => setNewOppTitle(e.target.value)}
                  placeholder="Ex: Licença Premium - Empresa X"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Valor estimado (BRL)</Label>
                <Input
                  type="number"
                  value={newOppValue}
                  onChange={(e) => setNewOppValue(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Etapa Inicial</Label>
                <Select value={newOppStageId} onValueChange={setNewOppStageId}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Contato Principal</Label>
                <Select value={newOppContactId} onValueChange={setNewOppContactId}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Selecione um contato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone_e164})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Responsável (Dono)</Label>
                <Select value={newOppOwnerId} onValueChange={setNewOppOwnerId}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Escolha um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.display_name || o.full_name || o.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Prioridade</Label>
                <Select value={newOppPriority} onValueChange={(v: any) => setNewOppPriority(v)}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Temperatura</Label>
                <Select value={newOppTemp} onValueChange={(v: any) => setNewOppTemp(v)}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Frio</SelectItem>
                    <SelectItem value="warm">Morno</SelectItem>
                    <SelectItem value="hot">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOppOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => oppMutation.mutate()} disabled={!newOppTitle.trim()}>
                Criar Oportunidade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    ),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">

      {/* Top metrics bar */}
      <div className="flex gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-muted-foreground/10 bg-muted/10 shrink-0 overflow-x-auto no-scrollbar">
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10 min-w-[200px] sm:flex-1 shrink-0">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-500 bg-blue-500/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Valor total em aberto
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatCurrency(totalOpenValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10 min-w-[180px] sm:flex-1 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary bg-primary/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Deals abertos
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">{filteredOpps.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10 min-w-[180px] sm:flex-1 shrink-0">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-indigo-500 bg-indigo-500/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Taxa de Conversão
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {(stats?.conversion_rate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10 min-w-[200px] sm:flex-1 shrink-0">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Ganho
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatCurrency(totalWonValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10 min-w-[200px] sm:flex-1 shrink-0">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-rose-500 bg-rose-500/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Perdido
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatCurrency(totalLostValue)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and control bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-muted-foreground/10 bg-card shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 w-full">
          {/* Search */}
          <div className="relative w-full sm:max-w-xs md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 w-full"
              placeholder="Buscar por título ou contato…"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Temperature */}
            <div className="flex-1 sm:w-[120px] sm:flex-none">
              <Select value={tempFilter} onValueChange={setTempFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Temperatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="cold">❄️ Frio</SelectItem>
                  <SelectItem value="warm">🔥 Morno</SelectItem>
                  <SelectItem value="hot">⚡ Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="flex-1 sm:w-[120px] sm:flex-none">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            {viewMode === "table" && (
              <div className="flex-1 sm:w-[120px] sm:flex-none">
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abertas</SelectItem>
                    <SelectItem value="won">Ganhos</SelectItem>
                    <SelectItem value="lost">Perdidos</SelectItem>
                    <SelectItem value="paused">Pausados</SelectItem>
                    <SelectItem value="archived">Arquivados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* View toggles */}
        <div className="flex w-full md:w-auto border border-muted-foreground/10 rounded-lg p-0.5 overflow-hidden">
          <Button
            size="sm"
            variant={viewMode === "kanban" ? "default" : "ghost"}
            className="flex-1 md:flex-none h-8 rounded-md px-3"
            onClick={() => setViewMode("kanban")}
          >
            <Kanban className="w-4 h-4 mr-2" /> Kanban
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="flex-1 md:flex-none h-8 rounded-md px-3"
            onClick={() => setViewMode("table")}
          >
            <Table className="w-4 h-4 mr-2" /> Tabela
          </Button>
        </div>
      </div>

      {/* Main Board view */}
      <div className="flex-1 overflow-hidden h-full">
        {loadingStages || loadingOpps ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Carregando oportunidades no pipeline...
          </div>
        ) : viewMode === "kanban" ? (
          <KanbanBoard
            stages={stages}
            opportunities={filteredOpps}
            owners={owners}
            onMoveOpportunity={handleMoveCard}
            onCardClick={(id) => setSelectedOppId(id)}
            onEditStage={handleOpenStageForm}
            onDeleteStage={handleDeleteStageClick}
            onManageStages={() => {
              setStageManagerOpen(true);
              setStageView("list");
            }}
            onAddStage={() => handleOpenStageForm(null)}
            onAddOpportunity={(stageId) => handleOpenNewOppModal(stageId)}
          />
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <div className="rounded-xl border border-muted-foreground/10 overflow-hidden bg-card shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-muted-foreground/10 bg-muted/20 font-semibold text-muted-foreground">
                    <th className="p-3">Título</th>
                    <th className="p-3">Contato</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Prioridade</th>
                    <th className="p-3">Temperatura</th>
                    <th className="p-3">Previsão</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-foreground/10">
                  {filteredOpps.map((opp: any) => (
                    <tr key={opp.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-medium text-foreground">{opp.title}</td>
                      <td className="p-3 text-muted-foreground">
                        {opp.primary_contact_name || "-"}
                      </td>
                      <td className="p-3 font-semibold">{formatCurrency(opp.value)}</td>
                      <td className="p-3 text-muted-foreground">
                        {owners.find((o: any) => o.id === opp.owner_user_id)?.display_name || "-"}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-normal capitalize">
                          {opp.priority}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-normal capitalize">
                          {opp.temperature || "Frio"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {opp.expected_close_date
                          ? new Date(opp.expected_close_date).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedOppId(opp.id)}>
                          Visualizar
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredOpps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Nenhuma oportunidade comercial encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Opportunity detail drawer/modal */}
      <OpportunityModal
        opportunityId={selectedOppId}
        funnels={funnels}
        stages={stages}
        owners={owners}
        onClose={() => setSelectedOppId(null)}
      />

      {/* Dialog: Gerenciar Etapas */}
      <Dialog open={stageManagerOpen} onOpenChange={setStageManagerOpen}>
        <DialogContent className="max-w-lg bg-card border border-muted-foreground/15 rounded-xl p-6 flex flex-col h-[650px] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stageView === "list" ? (
                <>
                  <Settings className="w-5 h-5 text-primary" /> Gerenciar Etapas do Funil
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1"
                    onClick={() => setStageView("list")}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  {editingStage ? "Editar Etapa" : "Nova Etapa"}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {stageView === "list" ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center my-4 shrink-0">
                <span className="text-xs text-muted-foreground">
                  Arranje e configure as etapas do seu pipeline.
                </span>
                <Button size="sm" onClick={() => handleOpenStageForm(null)}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Etapa
                </Button>
              </div>

              {/* Stages list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {stages.map((st: any, idx: number) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 bg-muted/20 border border-muted-foreground/10 rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-muted-foreground/10"
                        style={{ backgroundColor: st.color || "#64748b" }}
                      />
                      <div>
                        <span className="font-semibold text-sm">{st.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <span>Previsão: {Number(st.probability_percent || 0).toFixed(0)}%</span>
                          {st.is_won_stage && (
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px] py-0 px-1 font-normal"
                            >
                              Ganho
                            </Badge>
                          )}
                          {st.is_lost_stage && (
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] py-0 px-1 font-normal"
                            >
                              Perdido
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Reorder actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={idx === 0}
                        onClick={() => handleMoveStage(idx, "up")}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={idx === stages.length - 1}
                        onClick={() => handleMoveStage(idx, "down")}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>

                      {/* Edit actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenStageForm(st)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>

                      {/* Delete actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteStageClick(st)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {stages.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Nenhuma etapa configurada para este funil.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 my-4 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Nome da Etapa</Label>
                <Input
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  placeholder="Ex: Novo Lead, Demonstração, Proposta..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Probabilidade de Fechamento (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stageProb}
                  onChange={(e) => setStageProb(Math.min(100, Math.max(0, Number(e.target.value))))}
                />
                <span className="text-[11px] text-muted-foreground block">
                  Usado para calcular a previsão de faturamento ponderada (ex: se o valor for BRL
                  10.000 e probabilidade for 50%, a previsão de fechamento ponderada será BRL
                  5.000).
                </span>
              </div>

              <div className="space-y-2">
                <Label>Cor da Etapa</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-7 h-7 rounded-full border border-muted-foreground/20 relative flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      onClick={() => setStageColor(c)}
                    >
                      {stageColor === c && (
                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 border border-muted-foreground/15 rounded-lg px-2 py-0.5 bg-muted/10">
                    <Input
                      type="color"
                      className="w-7 h-7 p-0 border-0 cursor-pointer rounded bg-transparent"
                      value={stageColor}
                      onChange={(e) => setStageColor(e.target.value)}
                    />
                    <span className="text-xs font-mono tracking-tight text-muted-foreground">
                      {stageColor}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-muted-foreground/10">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Configurações Especiais
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="flex items-center gap-2 border border-muted-foreground/10 rounded-xl p-3 bg-muted/5 hover:bg-muted/10 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsWonStage(!isWonStage);
                      if (!isWonStage) setIsLostStage(false);
                    }}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-muted-foreground/20 text-primary focus:ring-primary pointer-events-none"
                      checked={isWonStage}
                      readOnly
                    />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">Marcar como Ganhos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Negócios que entrarem nesta etapa são dados como ganhos.
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 border border-muted-foreground/10 rounded-xl p-3 bg-muted/5 hover:bg-muted/10 cursor-pointer transition-colors"
                    onClick={() => {
                      setIsLostStage(!isLostStage);
                      if (!isLostStage) setIsWonStage(false);
                    }}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-muted-foreground/20 text-primary focus:ring-primary pointer-events-none"
                      checked={isLostStage}
                      readOnly
                    />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">Marcar como Perdidos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Negócios que entrarem nesta etapa são dados como perdidos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 border-t border-muted-foreground/10">
                {editingStage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      const st = editingStage;
                      setStageManagerOpen(false);
                      handleDeleteStageClick(st);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Etapa
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setStageView("list")}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveStage}
                    disabled={
                      !stageName.trim() ||
                      createStageMutation.isPending ||
                      updateStageMutation.isPending
                    }
                  >
                    {editingStage ? "Salvar Alterações" : "Criar Etapa"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Stage Confirmation with Migration */}
      <Dialog
        open={!!stageToDelete}
        onOpenChange={(open) => {
          if (!open) setStageToDelete(null);
        }}
      >
        <DialogContent className="max-w-md bg-card border border-muted-foreground/15 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" /> Migrar Oportunidades Existentes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <span className="text-xs text-muted-foreground block">
              A etapa <span className="font-bold text-foreground">"{stageToDelete?.name}"</span>{" "}
              possui oportunidades comerciais ativas. Selecione para qual etapa deseja migrar estas
              oportunidades antes de excluir:
            </span>

            <div className="space-y-1.5">
              <Label>Etapa de Destino</Label>
              <Select value={migrationStageId} onValueChange={setMigrationStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages
                    .filter((s: any) => s.id !== stageToDelete?.id)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteWithMigration}
              disabled={!migrationStageId || deleteStageMutation.isPending}
            >
              Migrar e Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
