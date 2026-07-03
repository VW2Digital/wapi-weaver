import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { toast } from "sonner";
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
  ShieldAlert
} from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import {
  listLicenses,
  createLicense,
  deleteLicense,
  getLicenseStats,
  getLicenseRole
} from "@/lib/license-admin.functions";

export const Route = createFileRoute("/_app/licenses/")({
  component: LicensesPage
});

function LicensesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const fetchLicenses = useServerFn(listLicenses);
  const fetchStats = useServerFn(getLicenseStats);
  const createLicenseMut = useServerFn(createLicense);
  const deleteLicenseMut = useServerFn(deleteLicense);
  const fetchLicenseRole = useServerFn(getLicenseRole);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["license-role"],
    queryFn: () => fetchLicenseRole({}),
    staleTime: 60_000
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["licenses", { search, status, plan, page }],
    queryFn: () => fetchLicenses({ data: { search, status, plan, page, limit: 15 } }),
    enabled: roleData?.role === "panel" && !!roleData?.isAdmin,
    placeholderData: (prev) => prev
  });

  const { data: statsData } = useQuery({
    queryKey: ["licenses-stats"],
    queryFn: () => fetchStats({}),
    enabled: roleData?.role === "panel" && !!roleData?.isAdmin
  });

  if (roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Verificando permissões...
      </div>
    );
  }

  if (roleData && (roleData.role !== "panel" || !roleData.isAdmin)) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-20 space-y-4">
        <h2 className="text-2xl font-bold text-red-500">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Você não possui privilégios de administrador ou esta instalação não está configurada como Painel de Licenças.
        </p>
        <Button asChild>
          <Link to="/">Voltar para o início</Link>
        </Button>
      </div>
    );
  }



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
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLicenseMut({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      toast.success("Domínio removido com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao remover domínio.");
    }
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
      notes
    });
  };

  return (
    <div className="space-y-8 p-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Gerenciamento de Clientes</h1>
          <p className="text-muted-foreground">Gerencie os acessos, planos e datas de validade de cada cliente/instância.</p>
        </div>

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
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
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
            <div className="text-2xl font-bold text-amber-600">{statsData?.totals.expired ?? 0}</div>
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
              <div className="text-sm opacity-80 mt-1">{(error as any).message || "Erro de conexão"}</div>
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
                    const expires = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : "Nunca";
                    return (
                      <TableRow key={lic.id}>
                        <TableCell className="font-semibold text-primary">{lic.license_key_preview}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{lic.client_name}</div>
                            <div className="text-xs text-muted-foreground">{lic.client_email || "N/A"}</div>
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
                            {lic.status === "active" ? "Ativo" : lic.status === "blocked" ? "Bloqueado" : "Expirado"}
                          </Badge>
                        </TableCell>
                        <TableCell>{expires}</TableCell>
                        <TableCell className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" asChild>
                            <Link to="/licenses/$id" params={{ id: String(lic.id) }}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(lic.id, lic.license_key_preview)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
