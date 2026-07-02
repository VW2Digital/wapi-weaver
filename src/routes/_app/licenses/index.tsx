import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
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
  Key,
  Plus,
  Search,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Ban,
  Activity,
  Calendar
} from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import {
  listLicenses,
  createLicense,
  deleteLicense,
  getLicenseStats
} from "@/lib/license-admin.functions";

export const Route = createFileRoute("/_app/licenses/")({
  component: LicensesPage
});

function LicensesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [maxActivations, setMaxActivations] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const fetchLicenses = useServerFn(listLicenses);
  const fetchStats = useServerFn(getLicenseStats);
  const createLicenseMut = useServerFn(createLicense);
  const deleteLicenseMut = useServerFn(deleteLicense);

  const { data, isLoading } = useQuery({
    queryKey: ["licenses", { search, status, plan, page }],
    queryFn: () => fetchLicenses({ search, status, plan, page, limit: 15 }),
    placeholderData: (prev) => prev
  });

  const { data: statsData } = useQuery({
    queryKey: ["licenses-stats"],
    queryFn: () => fetchStats({})
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createLicenseMut({ data: payload }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      setIsCreateOpen(false);
      
      // Reset form
      setClientName("");
      setClientEmail("");
      setSelectedPlan("basic");
      setMaxActivations(1);
      setExpiresAt("");
      setNotes("");

      // Show generated license dialog
      DialogLicenseKey(res.licenseKey);
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao gerar licença.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLicenseMut({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["licenses-stats"] });
      toast.success("Licença removida com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao remover licença.");
    }
  });

  const handleDelete = async (id: number, preview: string) => {
    const ok = await confirm({
      title: "Remover Licença",
      description: `Tem certeza que deseja remover a licença ${preview}? Todas as ativações ativas associadas a ela serão revogadas imediatamente.`,
      confirmText: "Remover",
      variant: "destructive"
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
    createMutation.mutate({
      client_name: clientName,
      client_email: clientEmail,
      plan: selectedPlan,
      max_activations: maxActivations,
      expires_at: expiresAt || null,
      notes
    });
  };

  const DialogLicenseKey = (key: string) => {
    confirm({
      title: "Chave de Licença Gerada",
      description: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copie a chave abaixo. Por motivos de segurança, ela não será exibida novamente no painel.
          </p>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3 font-mono text-sm font-semibold select-all">
            <span>{key}</span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(key);
                toast.success("Copiado!");
              }}
            >
              Copiar
            </Button>
          </div>
        </div>
      ),
      confirmText: "Fechar",
      cancelText: ""
    });
  };

  return (
    <div className="space-y-8 p-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Painel de Licenças</h1>
          <p className="text-muted-foreground">Gerencie as chaves de licença, planos e domínios ativos dos seus clientes.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Gerar Licença
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Gerar Nova Licença</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Cliente *</Label>
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
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="max_act">Limite Ativações</Label>
                    <Input
                      id="max_act"
                      type="number"
                      min={1}
                      value={maxActivations}
                      onChange={(e) => setMaxActivations(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expires">Data de Expiração (Opcional)</Label>
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
                    placeholder="ex: Contato do cliente, observações gerais..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar
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
            <CardTitle className="text-sm font-medium">Total de Licenças</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.totals.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Cadastradas no banco</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statsData?.totals.active ?? 0}</div>
            <p className="text-xs text-muted-foreground">Acesso permitido</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirações</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{statsData?.totals.expired ?? 0}</div>
            <p className="text-xs text-muted-foreground">Expiradas ou suspensas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqueios</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statsData?.totals.blocked ?? 0}</div>
            <p className="text-xs text-muted-foreground">Acesso banido</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and List Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Chaves de Licença</CardTitle>
          <CardDescription>Filtre e gerencie as licenças geradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 w-full gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por cliente, e-mail ou chave..."
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
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando licenças...
            </div>
          ) : !data?.licenses.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Key className="h-10 w-10 mb-4 opacity-40" />
              Nenhuma licença encontrada.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chave (Preview)</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativações</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.licenses.map((lic) => {
                    const expires = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : "Nunca";
                    return (
                      <TableRow key={lic.id}>
                        <TableCell className="font-mono text-sm font-semibold">{lic.license_key_preview}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{lic.client_name}</div>
                            <div className="text-xs text-muted-foreground">{lic.client_email || "N/A"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{lic.plan}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              lic.status === "active"
                                ? "success"
                                : lic.status === "blocked"
                                ? "destructive"
                                : "outline"
                            }
                            className="capitalize"
                          >
                            {lic.status === "active" ? "Ativa" : lic.status === "blocked" ? "Bloqueada" : "Expirada"}
                          </Badge>
                        </TableCell>
                        <TableCell>{lic.max_activations} ativações max</TableCell>
                        <TableCell>{expires}</TableCell>
                        <TableCell className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" asChild>
                            <Link to={`/licenses/${lic.id}`}>
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
