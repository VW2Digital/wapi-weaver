import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Trash2, Users as UsersIcon, Loader2, BarChart3, Mail, Send, CheckCheck, XCircle, Clock, FileText, Tag, List as ListIcon, Megaphone } from "lucide-react";
import { listUsers, createUser, setUserRole, deleteUser, getUserActivity } from "@/lib/users-admin.functions";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

function UsersPage() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["current-roles"],
    queryFn: () => fetchRoles({}),
  });

  if (roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!roleData?.isAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              Esta área é exclusiva para administradores da plataforma.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <AdminUsers />;
}

function AdminUsers() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const setRole = useServerFn(setUserRole);
  const del = useServerFn(deleteUser);
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({}),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createMut = useMutation({
    mutationFn: (input: { email: string; password: string; display_name?: string; role: "admin" | "user" }) =>
      create({ data: input }),
    onSuccess: () => {
      toast.success("Usuário criado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar"),
  });

  const roleMut = useMutation({
    mutationFn: (input: { user_id: string; role: "admin" | "user"; grant: boolean }) =>
      setRole({ data: input }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Usuário removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "user" as "admin" | "user" });
  const [activityUser, setActivityUser] = useState<{ id: string; email: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMut.mutateAsync({
      email: form.email,
      password: form.password,
      display_name: form.display_name || undefined,
      role: form.role,
    });
    setOpen(false);
    setForm({ email: "", password: "", display_name: "", role: "user" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="border-b px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <UsersIcon className="h-5 w-5" /> Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie usuários e defina quem tem acesso administrativo.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>Criar novo usuário</DialogTitle>
                <DialogDescription>
                  O usuário receberá acesso imediato (email já confirmado).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Nome (opcional)</Label>
                  <Input
                    id="display_name"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha provisória</Label>
                  <Input
                    id="password"
                    type="text"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Perfil</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as "admin" | "user" })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros da plataforma</CardTitle>
            <CardDescription>
              Ative o toggle de administrador para conceder acesso às Configurações da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último login</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.users.map((u) => {
                    const isAdmin = u.roles.includes("admin");
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {u.email}
                            {isAdmin && (
                              <Badge variant="secondary" className="gap-1">
                                <ShieldCheck className="h-3 w-3" /> Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.confirmed ? "default" : "outline"}>
                            {u.confirmed ? "Ativo" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={isAdmin}
                            disabled={roleMut.isPending}
                            onCheckedChange={(checked) =>
                              roleMut.mutate({ user_id: u.id, role: "admin", grant: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Ver relatório de interação"
                              onClick={() => setActivityUser({ id: u.id, email: u.email })}
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={delMut.isPending}
                              onClick={() => {
                                if (confirm(`Excluir o usuário ${u.email}? Esta ação é permanente.`)) {
                                  delMut.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <UserActivityDialog
        user={activityUser}
        onOpenChange={(o) => !o && setActivityUser(null)}
      />
    </div>
  );
}

function UserActivityDialog({
  user,
  onOpenChange,
}: {
  user: { id: string; email: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchActivity = useServerFn(getUserActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["user-activity", user?.id],
    queryFn: () => fetchActivity({ data: { user_id: user!.id } }),
    enabled: !!user,
  });

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Relatório de interação
          </DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <section className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Conta criada" value={fmt(data.profile.created_at)} />
              <InfoRow label="Email confirmado" value={fmt(data.profile.confirmed_at)} />
              <InfoRow label="Último login" value={fmt(data.profile.last_sign_in_at)} />
              <InfoRow
                label="Status"
                value={data.profile.confirmed_at ? "Ativo" : "Pendente"}
              />
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Resumo geral
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard icon={Megaphone} label="Campanhas" value={data.campaigns.total} />
                <StatCard icon={Mail} label="Mensagens" value={data.messages.total} />
                <StatCard icon={UsersIcon} label="Contatos" value={data.contacts} />
                <StatCard icon={ListIcon} label="Listas" value={data.lists} />
                <StatCard icon={Tag} label="Tags" value={data.tags} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Send className="h-4 w-4" /> Mensagens por status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <StatusPill icon={Clock} label="Pendentes" value={data.messages.byStatus.pending ?? 0} />
                <StatusPill icon={Send} label="Enviadas" value={data.messages.byStatus.sent ?? 0} />
                <StatusPill icon={CheckCheck} label="Entregues" value={data.messages.byStatus.delivered ?? 0} />
                <StatusPill icon={CheckCheck} label="Lidas" value={data.messages.byStatus.read ?? 0} />
                <StatusPill icon={XCircle} label="Falhas" value={data.messages.byStatus.failed ?? 0} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Templates ({data.templates.total})
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.templates.byStatus).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Nenhum template criado.</span>
                ) : (
                  Object.entries(data.templates.byStatus).map(([s, n]) => (
                    <Badge key={s} variant="outline">
                      {s}: {n}
                    </Badge>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-3">Campanhas recentes</h3>
              {data.campaigns.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Entregues/Total</TableHead>
                      <TableHead>Criada em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campaigns.recent.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {(c.totals?.delivered ?? 0)}/{(c.totals?.total ?? 0)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt(c.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
