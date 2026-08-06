import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe,
  Plus,
  Search,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Ban,
  Calendar,
  ShieldAlert,
  MoreHorizontal,
  CreditCard,
  Pencil,
} from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRoles } from "@/hooks/use-roles";
import { hasMasterRole } from "@/lib/roles";
import {
  listLicenses,
  createLicense,
  updateLicense,
  deleteLicense,
  getLicenseStats,
  getLicenseRole,
  listPlans,
} from "@/lib/license-admin.functions";
import { PlansManager } from "@/components/licenses/plans-manager";
import { BannersManager } from "@/components/licenses/banners-manager";

function LicensesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const fetchLicenses = useServerFn(listLicenses);
  const fetchStats = useServerFn(getLicenseStats);
  const createLicenseMut = useServerFn(createLicense);
  const updateLicenseMut = useServerFn(updateLicense);
  const deleteLicenseMut = useServerFn(deleteLicense);
  const fetchLicenseRole = useServerFn(getLicenseRole);
  const fetchPlans = useServerFn(listPlans);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Edit Modal State
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editPlan, setEditPlan] = useState("basic");
  const [editStatus, setEditStatus] = useState("active");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Form State
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const { roles, loading: roleLoading } = useRoles();
  const isAdminMasterUser = hasMasterRole(roles);

  const { data, isLoading, error } = useQuery({
    queryKey: ["licenses", { search, status, plan, page }],
    queryFn: () => fetchLicenses({ data: { search, status, plan, page, limit: 20 } }),
    enabled: isAdminMasterUser,
  });

  const { data: statsData } = useQuery({
    queryKey: ["licenses-stats"],
    queryFn: () => fetchStats({}),
    enabled: isAdminMasterUser,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createLicenseMut({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      setIsCreateOpen(false);

      // Reset form
      setClientName("");
      setClientEmail("");
      setDomain("");
      setSelectedPlan("basic");
      setExpiresAt("");
      setNotes("");

      toast.success("Domínio autorizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao autorizar domínio.");
    },
  });

  const { data: plansData } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => fetchPlans({}),
    enabled: isAdminMasterUser,
  });

  const availablePlans = useMemo(() => {
    const defaultPlans = [
      { slug: "basic", name: "Básico" },
      { slug: "premium", name: "Premium" },
      { slug: "enterprise", name: "Enterprise" },
    ];
    if (!plansData?.plans?.length) return defaultPlans;

    const map = new Map<string, string>();
    for (const p of defaultPlans) {
      map.set(p.slug, p.name);
    }
    for (const p of plansData.plans) {
      const slug = (p.slug || p.id).toLowerCase();
      if (!map.has(slug)) {
        map.set(slug, p.name || slug);
      }
    }

    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [plansData]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateLicenseMut({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      setEditingLicense(null);
      toast.success("Plano / cliente atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao atualizar plano do cliente.");
    },
  });

  const openEditModal = (lic: any) => {
    setEditingLicense(lic);
    setEditClientName(lic.client_name || "");
    setEditClientEmail(lic.client_email || "");
    setEditPlan(lic.plan || "basic");
    setEditStatus(lic.status || "active");
    setEditNotes(lic.notes || "");
    if (lic.expires_at) {
      const d = new Date(lic.expires_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setEditExpiresAt(`${yyyy}-${mm}-${dd}`);
    } else {
      setEditExpiresAt("");
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;
    updateMutation.mutate({
      id: editingLicense.id,
      client_name: editClientName,
      client_email: editClientEmail,
      plan: editPlan,
      status: editStatus,
      max_activations: 99,
      expires_at: editExpiresAt || null,
      notes: editNotes,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLicenseMut({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      toast.success("Domínio removido com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao remover domínio.");
    },
  });

  const handleDelete = async (id: number, domainName: string) => {
    const ok = await confirm({
      title: "Revogar Acesso",
      description: `Tem certeza que deseja revogar o acesso do domínio ${domainName}? O sistema cliente deixará de funcionar imediatamente.`,
      confirmText: "Revogar",
      destructive: true,
    });
    if (ok) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Nome do cliente é obrigatório.");
      return;
    }
    if (!domain.trim()) {
      toast.error("Domínio é obrigatório.");
      return;
    }
    createMutation.mutate({
      client_name: clientName,
      client_email: clientEmail,
      domain: domain.trim().toLowerCase(),
      plan: selectedPlan,
      expires_at: expiresAt || null,
      notes,
    });
  };

  usePageHeader({
    title: "Gerenciamento de Clientes",
    subtitle: "Gerencie os acessos, planos e datas de validade de cada cliente/instância.",
    action: (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isAdminMasterUser && (
          <Button variant="outline" asChild>
            <Link to="/settings" search={{ s: "admin-payments" }} className="gap-2">
              <CreditCard className="h-4 w-4" /> Meios de Pagamento
            </Link>
          </Button>
        )}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domínio / URL do SaaS *</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="ex: app.cliente.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Cliente / Responsável *</Label>
                  <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ex: João Silva"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail do Cliente</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="ex: joao@empresa.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan">Plano</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expires">Data de Expiração / Validade (Opcional)</Label>
                  <Input
                    id="expires"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notas Internas</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ex: Observações gerais..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Liberar Acesso
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    ),
  });

  if (roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Verificando permissões...
      </div>
    );
  }

  if (!isAdminMasterUser) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-20 space-y-4">
        <h2 className="text-2xl font-bold text-red-500">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Você não possui privilégios de Administrador Master (admin_master) para acessar o painel de licenças.
        </p>
        <Button asChild>
          <Link to="/">Voltar para o início</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6 pb-16">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.totals.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no banco</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statsData?.totals.active ?? 0}</div>
            <p className="text-xs text-muted-foreground">Acesso permitido</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos/Expirados</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {statsData?.totals.expired ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Acesso suspenso</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqueados</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statsData?.totals.blocked ?? 0}</div>
            <p className="text-xs text-muted-foreground">Acesso bloqueado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and List Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Gerencie o status e a data de validade dos acessos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 w-full gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por cliente, e-mail ou domínio..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex w-full md:w-auto gap-2">
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={plan}
                onValueChange={(val) => {
                  setPlan(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Planos</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando domínios...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <ShieldAlert className="h-10 w-10 mb-4 opacity-50 animate-pulse" />
              <div className="font-semibold text-base">Falha ao carregar domínios</div>
              <div className="text-sm opacity-80 mt-1">
                {(error as any).message || "Erro de conexão"}
              </div>
            </div>
          ) : !data?.licenses.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Globe className="h-10 w-10 mb-4 opacity-40" />
              Nenhum domínio cadastrado.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio Autorizado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.licenses.map((lic) => {
                    const expires = lic.expires_at
                      ? new Date(lic.expires_at).toLocaleDateString()
                      : "Nunca";
                    return (
                      <TableRow key={lic.id}>
                        <TableCell className="font-semibold text-primary">
                          {lic.license_key_preview}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{lic.client_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {lic.client_email || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{lic.plan}</TableCell>
                        <TableCell>
                          <Badge
                            variant={lic.status === "blocked" ? "destructive" : "outline"}
                            className={`capitalize ${
                              lic.status === "active"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : ""
                            }`}
                          >
                            {lic.status === "active"
                              ? "Ativo"
                              : lic.status === "blocked"
                                ? "Bloqueado"
                                : "Expirado"}
                          </Badge>
                        </TableCell>
                        <TableCell>{expires}</TableCell>
                        <TableCell className="flex items-center justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => openEditModal(lic)}
                              >
                                <Pencil className="mr-2 h-4 w-4 text-blue-500" />
                                Editar / Alterar Plano
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  to="/licenses/$id"
                                  params={{ id: String(lic.id) }}
                                  className="w-full cursor-pointer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Detalhes
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDelete(lic.id, lic.license_key_preview)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.pages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Atribuir Plano / Editar Cliente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Domínio Autorizado</Label>
                <Input value={editingLicense?.license_key_preview || ""} disabled className="bg-muted font-mono text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nome do Cliente *</Label>
                <Input
                  id="edit-name"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">E-mail do Cliente</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editClientEmail}
                  onChange={(e) => setEditClientEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-plan">Plano Atribuído</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-expires">Data de Expiração (Opcional)</Label>
                <Input
                  id="edit-expires"
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notas Internas</Label>
                <Input
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PlansManager />
      <BannersManager />
    </div>
  );
}

export const Route = createFileRoute("/_app/licenses/")({
  component: LicensesPage,
});
