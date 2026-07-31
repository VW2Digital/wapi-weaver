import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Loader2, Save, MoreHorizontal, Settings, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/confirm-dialog";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listCommercialPlans,
  createCommercialPlan,
  updateCommercialPlan,
  deleteCommercialPlan,
} from "@/lib/license-admin.functions";

export function PlansManager() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"operational" | "commercial">("operational");

  // Operational Plan Dialog State
  const [isOpOpen, setIsOpOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [opName, setOpName] = useState("");
  const [opSlug, setOpSlug] = useState("");
  const [opDescription, setOpDescription] = useState("");
  const [opMaxAgents, setOpMaxAgents] = useState(1);
  const [opMaxFunnels, setOpMaxFunnels] = useState(1);
  const [opMaxUsers, setOpMaxUsers] = useState(1);
  const [opIsActive, setOpIsActive] = useState(true);

  // Commercial Plan Dialog State
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [editingCommId, setEditingCommId] = useState<string | null>(null);
  const [commId, setCommId] = useState("");
  const [commName, setCommName] = useState("");
  const [commDescription, setCommDescription] = useState("");
  const [commPrice, setCommPrice] = useState(0.0);
  const [commCurrency, setCommCurrency] = useState("BRL");
  const [commInterval, setCommInterval] = useState<"day" | "week" | "month" | "year">("month");
  const [commIntervalCount, setCommIntervalCount] = useState(1);
  const [commDurationDays, setCommDurationDays] = useState(30);
  const [commIsActive, setCommIsActive] = useState(true);
  const [commSubPlanId, setCommSubPlanId] = useState<string>("");
  const [originalSubPlanId, setOriginalSubPlanId] = useState<string>("");

  // Queries
  const { data: opData, isLoading: opLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => listPlans(),
  });

  const { data: commData, isLoading: commLoading } = useQuery({
    queryKey: ["commercial-plans"],
    queryFn: () => listCommercialPlans(),
  });

  // Mutations - Operational Plans
  const createOpMut = useMutation({
    mutationFn: (payload: any) => createPlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      setIsOpOpen(false);
      toast.success("Plano operacional criado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar plano."),
  });

  const updateOpMut = useMutation({
    mutationFn: (payload: any) => updatePlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      setIsOpOpen(false);
      toast.success("Plano operacional atualizado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar plano."),
  });

  const deleteOpMut = useMutation({
    mutationFn: (id: string) => deletePlan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast.success("Plano operacional excluído com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir plano."),
  });

  // Mutations - Commercial Plans
  const createCommMut = useMutation({
    mutationFn: (payload: any) => createCommercialPlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-plans"] });
      setIsCommOpen(false);
      toast.success("Plano comercial criado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar plano comercial."),
  });

  const updateCommMut = useMutation({
    mutationFn: (payload: any) => updateCommercialPlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-plans"] });
      setIsCommOpen(false);
      toast.success("Plano comercial atualizado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar plano comercial."),
  });

  const deleteCommMut = useMutation({
    mutationFn: (id: string) => deleteCommercialPlan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-plans"] });
      toast.success("Plano comercial excluído.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir plano comercial."),
  });

  const handleOpenCreateOp = () => {
    setEditingOpId(null);
    setOpName("");
    setOpSlug("");
    setOpDescription("");
    setOpMaxAgents(1);
    setOpMaxFunnels(1);
    setOpMaxUsers(1);
    setOpIsActive(true);
    setIsOpOpen(true);
  };

  const handleOpenEditOp = (plan: any) => {
    setEditingOpId(plan.id);
    setOpName(plan.name);
    setOpSlug(plan.slug);
    setOpDescription(plan.description || "");
    setOpMaxAgents(plan.max_agents);
    setOpMaxFunnels(plan.max_funnels);
    setOpMaxUsers(plan.max_users);
    setOpIsActive(Boolean(plan.is_active));
    setIsOpOpen(true);
  };

  const handleDeleteOp = async (plan: any) => {
    const ok = await confirm({
      title: "Excluir Plano Operacional",
      description: `Tem certeza que deseja excluir o plano operacional "${plan.name}"? Isso revogará o link de planos comerciais correspondentes.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) {
      deleteOpMut.mutate(plan.id);
    }
  };

  const handleSaveOp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName.trim() || !opSlug.trim()) {
      toast.error("Nome e Slug são obrigatórios.");
      return;
    }
    const payload = {
      name: opName,
      slug: opSlug.toLowerCase(),
      description: opDescription,
      max_agents: opMaxAgents,
      max_funnels: opMaxFunnels,
      max_users: opMaxUsers,
      is_active: opIsActive,
    };
    if (editingOpId) {
      updateOpMut.mutate({ id: editingOpId, ...payload });
    } else {
      createOpMut.mutate(payload);
    }
  };

  const handleOpenCreateComm = () => {
    setEditingCommId(null);
    setCommId("");
    setCommName("");
    setCommDescription("");
    setCommPrice(0.0);
    setCommCurrency("BRL");
    setCommInterval("month");
    setCommIntervalCount(1);
    setCommDurationDays(30);
    setCommIsActive(true);
    setCommSubPlanId("");
    setOriginalSubPlanId("");
    setIsCommOpen(true);
  };

  const handleOpenEditComm = (plan: any) => {
    setEditingCommId(plan.id);
    setCommId(plan.id);
    setCommName(plan.name);
    setCommDescription(plan.description || "");
    setCommPrice(Number(plan.price));
    setCommCurrency(plan.currency);
    setCommInterval(plan.billing_interval);
    setCommIntervalCount(plan.billing_interval_count);
    setCommDurationDays(plan.duration_days);
    setCommIsActive(Boolean(plan.is_active));
    setCommSubPlanId(plan.subscription_plan_id || "");
    setOriginalSubPlanId(plan.subscription_plan_id || "");
    setIsCommOpen(true);
  };

  const handleDeleteComm = async (plan: any) => {
    const ok = await confirm({
      title: "Excluir Plano Comercial",
      description: `Tem certeza que deseja excluir o plano comercial "${plan.name}"? Isso impedirá novos checkouts para este plano.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) {
      deleteCommMut.mutate(plan.id);
    }
  };

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commId.trim() || !commName.trim()) {
      toast.error("Identificador e Nome são obrigatórios.");
      return;
    }

    // Show warning if operational plan link is being updated
    if (editingCommId && commSubPlanId !== originalSubPlanId && originalSubPlanId !== "") {
      const confirmed = await confirm({
        title: "Aviso de Mudança de Vínculo",
        description: "Você está alterando o plano operacional deste plano comercial. Assinaturas ativas existentes NÃO terão seus limites alterados retroativamente por motivos de segurança comercial.",
        confirmText: "Estou Ciente e Desejo Salvar",
        destructive: false,
      });
      if (!confirmed) return;
    }

    const payload = {
      id: commId.trim(),
      name: commName,
      description: commDescription,
      price: commPrice,
      currency: commCurrency,
      billing_interval: commInterval,
      billing_interval_count: commIntervalCount,
      duration_days: commDurationDays,
      is_active: commIsActive,
      subscription_plan_id: commSubPlanId || null,
    };

    if (editingCommId) {
      updateCommMut.mutate(payload);
    } else {
      createCommMut.mutate(payload);
    }
  };

  const ops = opData?.plans || [];
  const comms = commData?.plans || [];

  return (
    <div className="space-y-6 mt-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Planos e Precificação</h3>
          <p className="text-sm text-muted-foreground">
            Defina limites operacionais de recursos e precificações comerciais integradas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "operational" ? "default" : "outline"}
            onClick={() => setActiveTab("operational")}
            className="gap-2"
          >
            <Settings className="h-4 w-4" /> Plano Operacional (Limites)
          </Button>
          <Button
            variant={activeTab === "commercial" ? "default" : "outline"}
            onClick={() => setActiveTab("commercial")}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" /> Plano Comercial (Preços)
          </Button>
        </div>
      </div>

      {activeTab === "operational" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold">Limites e Recursos Operacionais</h4>
            <Button onClick={handleOpenCreateOp} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Plano Operacional
            </Button>
          </div>

          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Identificador (Slug)</TableHead>
                  <TableHead>Agentes IA</TableHead>
                  <TableHead>Funis</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : ops.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum plano operacional encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  ops.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {plan.slug}
                        </code>
                      </TableCell>
                      <TableCell>{plan.max_agents}</TableCell>
                      <TableCell>{plan.max_funnels}</TableCell>
                      <TableCell>{plan.max_users}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          plan.is_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditOp(plan)} className="cursor-pointer">
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteOp(plan)} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold">Precificações Comerciais</h4>
            <Button onClick={handleOpenCreateComm} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Plano Comercial
            </Button>
          </div>

          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Nome Comercial</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Moeda</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Vínculo Operacional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : comms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum plano comercial encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  comms.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono text-sm">{plan.id}</TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>R$ {Number(plan.price).toFixed(2)}</TableCell>
                      <TableCell className="uppercase">{plan.currency}</TableCell>
                      <TableCell className="capitalize">{plan.billing_interval}</TableCell>
                      <TableCell>
                        {plan.subscription_plan_name ? (
                          <span className="font-semibold text-primary">{plan.subscription_plan_name}</span>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Sem Vínculo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          plan.is_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditComm(plan)} className="cursor-pointer">
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteComm(plan)} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Operational Plan Dialog */}
      <Dialog open={isOpOpen} onOpenChange={setIsOpOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSaveOp}>
            <DialogHeader>
              <DialogTitle>{editingOpId ? "Editar Limites" : "Criar Plano Operacional"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="opName">Nome do Plano</Label>
                <Input id="opName" value={opName} onChange={(e) => {
                  setOpName(e.target.value);
                  if (!editingOpId) {
                    setOpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }
                }} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opSlug">Slug</Label>
                <Input id="opSlug" value={opSlug} onChange={(e) => setOpSlug(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="opAgents">Agentes IA</Label>
                  <Input id="opAgents" type="number" min={0} value={opMaxAgents} onChange={(e) => setOpMaxAgents(parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="opFunnels">Funis</Label>
                  <Input id="opFunnels" type="number" min={0} value={opMaxFunnels} onChange={(e) => setOpMaxFunnels(parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="opUsers">Usuários</Label>
                  <Input id="opUsers" type="number" min={0} value={opMaxUsers} onChange={(e) => setOpMaxUsers(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opDesc">Descrição</Label>
                <Input id="opDesc" value={opDescription} onChange={(e) => setOpDescription(e.target.value)} />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="opActive" checked={opIsActive} onCheckedChange={setOpIsActive} />
                <Label htmlFor="opActive">Plano Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full flex !rounded-md" disabled={createOpMut.isPending || updateOpMut.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar Plano Operacional
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Commercial Plan Dialog */}
      <Dialog open={isCommOpen} onOpenChange={setIsCommOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSaveComm}>
            <DialogHeader>
              <DialogTitle>{editingCommId ? "Editar Preço Comercial" : "Criar Plano Comercial"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="commId">Identificador do Plano (ID Comercial)</Label>
                <Input id="commId" value={commId} onChange={(e) => setCommId(e.target.value)} disabled={!!editingCommId} placeholder="ex: plan-mensal" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="commName">Nome Comercial</Label>
                <Input id="commName" value={commName} onChange={(e) => setCommName(e.target.value)} placeholder="ex: Bronze Mensal" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="commPrice">Preço (R$)</Label>
                  <Input id="commPrice" type="number" step="0.01" min={0} value={commPrice} onChange={(e) => setCommPrice(parseFloat(e.target.value) || 0.0)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commCurrency">Moeda</Label>
                  <Input id="commCurrency" value={commCurrency} onChange={(e) => setCommCurrency(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="commInterval">Intervalo</Label>
                  <select id="commInterval" className="rounded-md border p-2 bg-background text-foreground" value={commInterval} onChange={(e: any) => setCommInterval(e.target.value)}>
                    <option value="day">Dia</option>
                    <option value="week">Semana</option>
                    <option value="month">Mês</option>
                    <option value="year">Ano</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commIntervalCount">Ciclos</Label>
                  <Input id="commIntervalCount" type="number" min={1} value={commIntervalCount} onChange={(e) => setCommIntervalCount(parseInt(e.target.value) || 1)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commDuration">Duração (Dias)</Label>
                  <Input id="commDuration" type="number" min={1} value={commDurationDays} onChange={(e) => setCommDurationDays(parseInt(e.target.value) || 30)} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="commSubPlanId">Plano Operacional Vinculado (Limites)</Label>
                <select id="commSubPlanId" className="rounded-md border p-2 bg-background text-foreground" value={commSubPlanId} onChange={(e) => setCommSubPlanId(e.target.value)}>
                  <option value="">-- Sem vínculo --</option>
                  {ops.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="commDesc">Descrição Comercial</Label>
                <Input id="commDesc" value={commDescription} onChange={(e) => setCommDescription(e.target.value)} />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="commActive" checked={commIsActive} onCheckedChange={setCommIsActive} />
                <Label htmlFor="commActive">Plano Ativo para Vendas</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full flex !rounded-md" disabled={createCommMut.isPending || updateCommMut.isPending}>
                <Save className="mr-2 h-4 w-4" /> Salvar Plano Comercial
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
