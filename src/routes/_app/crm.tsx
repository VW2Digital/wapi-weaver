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
import { PageHeader } from "@/components/layout/page-header";
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
} from "lucide-react";

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
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: () => fetchOwners(),
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
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["crm-stats", activeId],
    queryFn: () => fetchStats({ data: { funnel_id: activeId } }),
    enabled: !!activeId,
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

  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  // Mutations
  const funnelMutation = useMutation({
    mutationFn: () =>
      addFunnel({
        data: { name: newFunnelName, description: newFunnelDesc, is_default: funnels.length === 0 },
      }),
    onSuccess: (res) => {
      toast.success("Funil de vendas criado!");
      setNewFunnelOpen(false);
      setNewFunnelName("");
      setNewFunnelDesc("");
      qc.invalidateQueries({ queryKey: ["funnels"] });
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
    mutationFn: ({ id, toStageId }: { id: string; toStageId: string }) =>
      moveOpp({
        data: {
          id,
          to_stage_id: toStageId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["crm-stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleMoveCard = (id: string, toStageId: string) => {
    moveMutation.mutate({ id, toStageId });
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title="Funis de Venda"
        subtitle="Gerencie suas oportunidades comerciais e pipeline de vendas de forma visual."
        action={
          <div className="flex items-center gap-3">
            {/* Funnel Selector */}
            {funnels.length > 0 && (
              <Select value={activeId} onValueChange={handleFunnelChange}>
                <SelectTrigger className="w-[200px]">
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
                onClick={() => {
                  setStageManagerOpen(true);
                  setStageView("list");
                }}
              >
                <Settings className="w-4 h-4 mr-2" /> Gerenciar Etapas
              </Button>
            )}

            {/* Add Funnel */}
            <Dialog open={newFunnelOpen} onOpenChange={setNewFunnelOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Novo Funil
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-card border border-muted-foreground/15 rounded-xl p-6">
                <DialogHeader>
                  <DialogTitle>Criar Novo Funil de Vendas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 my-4">
                  <div className="space-y-1.5">
                    <Label>Nome do Funil</Label>
                    <Input
                      value={newFunnelName}
                      onChange={(e: any) => setNewFunnelName(e.target.value)}
                      placeholder="Ex: Vendas Externas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Textarea
                      rows={3}
                      value={newFunnelDesc}
                      onChange={(e: any) => setNewFunnelDesc(e.target.value)}
                      placeholder="Descreva o propósito deste pipeline..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewFunnelOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => funnelMutation.mutate()} disabled={!newFunnelName.trim()}>
                    Criar Funil
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Opportunity */}
            <Dialog open={newOppOpen} onOpenChange={setNewOppOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Nova Oportunidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-card border border-muted-foreground/15 rounded-xl p-6">
                <DialogHeader>
                  <DialogTitle>Nova Oportunidade Comercial</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Título / Nome do Deal</Label>
                    <Input
                      value={newOppTitle}
                      onChange={(e) => setNewOppTitle(e.target.value)}
                      placeholder="Ex: Licença Premium - Empresa X"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor estimado (BRL)</Label>
                    <Input
                      type="number"
                      value={newOppValue}
                      onChange={(e) => setNewOppValue(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Etapa Inicial</Label>
                    <Select value={newOppStageId} onValueChange={setNewOppStageId}>
                      <SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label>Contato Principal</Label>
                    <Select value={newOppContactId} onValueChange={setNewOppContactId}>
                      <SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label>Responsável (Dono)</Label>
                    <Select value={newOppOwnerId} onValueChange={setNewOppOwnerId}>
                      <SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={newOppPriority} onValueChange={(v: any) => setNewOppPriority(v)}>
                      <SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label>Temperatura</Label>
                    <Select value={newOppTemp} onValueChange={(v: any) => setNewOppTemp(v)}>
                      <SelectTrigger>
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
        }
      />

      {/* Top metrics bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-muted-foreground/10 bg-muted/10 shrink-0">
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-500 bg-green-500/10 p-1.5 rounded-full" />
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
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10">
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
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10">
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
        <Card className="p-4 shadow-sm bg-card border border-muted-foreground/10">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-amber-500 bg-amber-500/10 p-1.5 rounded-full" />
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Faturamento previsto
              </span>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {formatCurrency(
                  stages.reduce((acc: number, s: any) => {
                    const stageOpps = filteredOpps.filter((o: any) => o.stage_id === s.id);
                    const stageVal = stageOpps.reduce(
                      (accVal: number, o: any) => accVal + (Number(o.value) || 0),
                      0,
                    );
                    return acc + stageVal * (Number(s.probability_percent || 0) / 100);
                  }, 0),
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and control bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-muted-foreground/10 bg-card shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Buscar por título ou contato…"
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
            />
          </div>

          {/* Temperature */}
          <div className="w-[120px]">
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="h-9">
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
          <div className="w-[120px]">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9">
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
            <div className="w-[120px]">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-9">
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

        {/* View toggles */}
        <div className="flex border border-muted-foreground/10 rounded-lg p-0.5 overflow-hidden">
          <Button
            size="sm"
            variant={viewMode === "kanban" ? "default" : "ghost"}
            className="h-8 rounded-md px-3"
            onClick={() => setViewMode("kanban")}
          >
            <Kanban className="w-4 h-4 mr-2" /> Kanban
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-8 rounded-md px-3"
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
            onAddStage={() => handleOpenStageForm(null)}
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

              <div className="flex justify-end gap-2 pt-4">
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
