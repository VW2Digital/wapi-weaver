import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Loader2,
  Trash2,
  Globe,
  CheckCircle,
  XCircle,
  Database
} from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import {
  getLicenseDetail,
  updateLicense,
  deleteActivation,
  getLicenseRole
} from "@/lib/license-admin.functions";

export const Route = createFileRoute("/_app/licenses/$id")({
  component: LicenseDetailPage
});

function LicenseDetailPage() {
  const { id } = Route.useParams();
  const numericId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const fetchDetail = useServerFn(getLicenseDetail);
  const updateLicenseMut = useServerFn(updateLicense);
  const deleteActivationMut = useServerFn(deleteActivation);
  const fetchLicenseRole = useServerFn(getLicenseRole);

  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["license-role"],
    queryFn: () => fetchLicenseRole({}),
    staleTime: 60_000
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["license-detail", numericId],
    queryFn: () => fetchDetail({ data: { id: numericId } }),
    enabled: roleData?.role === "panel" && !!roleData?.isAdmin
  });

  // Edit fields state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [plan, setPlan] = useState("basic");
  const [status, setStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data?.license) {
      const lic = data.license;
      setClientName(lic.client_name || "");
      setClientEmail(lic.client_email || "");
      setPlan(lic.plan || "basic");
      setStatus(lic.status || "active");
      setNotes(lic.notes || "");
      
      if (lic.expires_at) {
        const d = new Date(lic.expires_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setExpiresAt(`${yyyy}-${mm}-${dd}`);
      } else {
        setExpiresAt("");
      }
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateLicenseMut({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-detail", numericId] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      toast.success("Domínio atualizado com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar domínio.");
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (activationId: number) => deleteActivationMut({ data: { id: activationId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-detail", numericId] });
      toast.success("Instancia removida com sucesso.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao remover instancia.");
    }
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: numericId,
      client_name: clientName,
      client_email: clientEmail,
      plan,
      status,
      max_activations: 99,
      expires_at: expiresAt || null,
      notes
    });
  };

  const handleRevoke = async (actId: number, domain: string) => {
    const ok = await confirm({
      title: "Revogar Instância",
      description: `Tem certeza que deseja revogar esta conexão ativa da máquina do domínio ${domain}? Ela será recriada automaticamente na próxima requisição se o acesso continuar ativo.`,
      confirmText: "Revogar",
      variant: "destructive"
    });
    if (ok) {
      revokeMutation.mutate(actId);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando detalhes...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-500">Erro ao carregar detalhes</h2>
        <p className="text-muted-foreground mt-2">O domínio solicitado pode ter sido removido.</p>
        <Button className="mt-4" asChild>
          <Link to="/licenses">Voltar para lista</Link>
        </Button>
      </div>
    );
  }

  const { license, activations, logs } = data;

  return (
    <div className="space-y-8 p-6 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/licenses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{license.license_key_preview}</h1>
            <Badge variant="outline" className="capitalize">
              {license.plan}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Cliente: {license.client_name}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Update Form */}
        <Card className="md:col-span-1 shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Editar Propriedades</CardTitle>
            <CardDescription>Configure as opções de acesso do cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="cname">Nome do Cliente</Label>
                <Input
                  id="cname"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cemail">E-mail do Cliente</Label>
                <Input
                  id="cemail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
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
                <Label htmlFor="plan">Plano</Label>
                <Select value={plan} onValueChange={setPlan}>
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
                <Label htmlFor="expires">Expira em</Label>
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
                />
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Activations & Logs Section */}
        <div className="md:col-span-2 space-y-6">
          {/* Active Activations */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Conexões Ativas ({activations.length})</CardTitle>
              <CardDescription>Instâncias reportando requisições com este domínio.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activations.length ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Globe className="h-8 w-8 mb-2 opacity-40" />
                  Nenhum servidor ativado atualmente.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instância ID</TableHead>
                        <TableHead>Última Checagem</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="w-[100px] text-right">Revogar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activations.map((act) => {
                        const lastCheck = act.last_check_at
                          ? new Date(act.last_check_at).toLocaleString()
                          : "N/A";
                        return (
                          <TableRow key={act.id}>
                            <TableCell className="font-medium font-mono text-xs">
                              {act.installation_id}
                            </TableCell>
                            <TableCell className="text-sm">{lastCheck}</TableCell>
                            <TableCell className="text-sm font-mono">{act.ip_address || "N/A"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleRevoke(act.id, act.domain)}
                                disabled={revokeMutation.isPending}
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
            </CardContent>
          </Card>

          {/* Validation Logs */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Histórico de Validações</CardTitle>
              <CardDescription>Logs das requisições mais recentes.</CardDescription>
            </CardHeader>
            <CardContent>
              {!logs.length ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Database className="h-8 w-8 mb-2 opacity-40" />
                  Nenhuma validação gravada.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const date = new Date(log.created_at).toLocaleString();
                        const isSuccess = log.result === "success" || log.result === "active";
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm whitespace-nowrap">{date}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {isSuccess ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={isSuccess ? "text-green-600 text-xs font-semibold" : "text-red-600 text-xs font-semibold"}>
                                  {log.result}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono">{log.ip_address || "N/A"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
