import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Edit2, Trash2, Loader2, Save, MoreHorizontal } from "lucide-react";
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
} from "@/lib/license-admin.functions";

export function PlansManager() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [maxAgents, setMaxAgents] = useState(1);
  const [maxFunnels, setMaxFunnels] = useState(1);
  const [maxUsers, setMaxUsers] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => listPlans(),
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => createPlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      setIsOpen(false);
      toast.success("Plano criado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar plano."),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => updatePlan({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      setIsOpen(false);
      toast.success("Plano atualizado com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar plano."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePlan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast.success("Plano excluído com sucesso.");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir plano."),
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setMaxAgents(1);
    setMaxFunnels(1);
    setMaxUsers(1);
    setIsActive(true);
    setIsOpen(true);
  };

  const handleOpenEdit = (plan: any) => {
    setEditingId(plan.id);
    setName(plan.name);
    setSlug(plan.slug);
    setDescription(plan.description || "");
    setMaxAgents(plan.max_agents);
    setMaxFunnels(plan.max_funnels);
    setMaxUsers(plan.max_users);
    setIsActive(Boolean(plan.is_active));
    setIsOpen(true);
  };

  const handleDelete = async (plan: any) => {
    const ok = await confirm({
      title: "Excluir Plano",
      description: `Tem certeza que deseja excluir o plano "${plan.name}"? Isso pode afetar os clientes que estão usando-o.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) {
      deleteMut.mutate(plan.id);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("Nome e slug são obrigatórios.");
      return;
    }

    const payload = {
      name,
      slug: slug.toLowerCase(),
      description,
      max_agents: maxAgents,
      max_funnels: maxFunnels,
      max_users: maxUsers,
      is_active: Boolean(isActive),
    };

    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const plans = data?.plans || [];

  return (
    <div className="space-y-4 mt-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Planos e Limites</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os planos de assinatura e defina o que cada plano permite criar.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Plano
        </Button>
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhum plano encontrado.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                      {plan.slug}
                    </code>
                  </TableCell>
                  <TableCell>{plan.max_agents}</TableCell>
                  <TableCell>{plan.max_funnels}</TableCell>
                  <TableCell>{plan.max_users}</TableCell>
                  <TableCell>
                    {plan.is_active ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-500 border-zinc-200">
                        Inativo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(plan)} className="cursor-pointer">
                          <Edit2 className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(plan)}
                          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Plano" : "Criar Novo Plano"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingId) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }
                  }}
                  placeholder="ex: Premium"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Identificador (Slug)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ex: premium"
                  required
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="max_agents">Agentes IA</Label>
                  <Input
                    id="max_agents"
                    type="number"
                    min={0}
                    value={maxAgents}
                    onChange={(e) => setMaxAgents(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="max_funnels">Funis</Label>
                  <Input
                    id="max_funnels"
                    type="number"
                    min={0}
                    value={maxFunnels}
                    onChange={(e) => setMaxFunnels(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="max_users">Usuários</Label>
                  <Input
                    id="max_users"
                    type="number"
                    min={0}
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="desc">Descrição (Opcional)</Label>
                <Input
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição curta..."
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="active">Plano Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full flex !rounded-md" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Plano
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
