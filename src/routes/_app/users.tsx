import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  ShieldCheck,
  UserPlus,
  Trash2,
  Users as UsersIcon,
  Loader2,
  BarChart3,
  Mail,
  Send,
  CheckCheck,
  XCircle,
  Clock,
  FileText,
  Tag,
  List as ListIcon,
  Megaphone,
} from "lucide-react";
import {
  listUsers,
  createUser,
  setUserRole,
  deleteUser,
  getUserActivity,
} from "@/lib/users-admin.functions";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useConfirm } from "@/components/confirm-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listTeams,
  listTeamMembers,
  listAllAgents,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
} from "@/lib/assignment.functions";
import { Edit, Plus, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

function UsersPage() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["current-roles"],
    queryFn: () => fetchRoles({}),
  });

  const [activeTab, setActiveTab] = useState<"users" | "teams">("users");

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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="px-8 pt-4 border-b bg-muted/10 shrink-0 flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Equipes e Setores
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "users" ? <AdminUsers /> : <AdminTeams />}
      </div>
    </div>
  );
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
    mutationFn: (input: {
      email: string;
      password: string;
      display_name?: string;
      role: "admin" | "user";
    }) => create({ data: input }),
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
  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
    role: "user" as "admin" | "user",
  });
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
                  {data?.users.map((u: any) => {
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
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Excluir usuário?",
                                  description: `${u.email} será removido permanentemente. Esta ação não pode ser desfeita.`,
                                  confirmText: "Excluir",
                                  destructive: true,
                                });
                                if (ok) delMut.mutate(u.id);
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

      <UserActivityDialog user={activityUser} onOpenChange={(o) => !o && setActivityUser(null)} />
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
              <InfoRow label="Status" value={data.profile.confirmed_at ? "Ativo" : "Pendente"} />
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
                <StatusPill
                  icon={Clock}
                  label="Pendentes"
                  value={data.messages.byStatus.pending ?? 0}
                />
                <StatusPill icon={Send} label="Enviadas" value={data.messages.byStatus.sent ?? 0} />
                <StatusPill
                  icon={CheckCheck}
                  label="Entregues"
                  value={data.messages.byStatus.delivered ?? 0}
                />
                <StatusPill
                  icon={CheckCheck}
                  label="Lidas"
                  value={data.messages.byStatus.read ?? 0}
                />
                <StatusPill
                  icon={XCircle}
                  label="Falhas"
                  value={data.messages.byStatus.failed ?? 0}
                />
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
                          {c.totals?.delivered ?? 0}/{c.totals?.total ?? 0}
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

function AdminTeams() {
  const qc = useQueryClient();
  const fetchTeams = useServerFn(listTeams);
  const delTeam = useServerFn(deleteTeam);
  const confirm = useConfirm();

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teams"] });

  const deleteTeamMut = useMutation({
    mutationFn: (id: string) => delTeam({ data: { id } }),
    onSuccess: () => {
      toast.success("Equipe removida com sucesso!");
      invalidate();
    },
    onError: (err: any) => {
      toast.error("Erro ao remover equipe: " + err.message);
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [membersTeam, setMembersTeam] = useState<any>(null);

  const handleEdit = (team: any) => {
    setEditingTeam(team);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingTeam(null);
    setFormOpen(true);
  };

  const handleDelete = async (team: any) => {
    const ok = await confirm({
      title: "Excluir equipe?",
      description: `A equipe "${team.name}" será removida permanentemente. As atribuições ativas dessa equipe serão removidas.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) {
      deleteTeamMut.mutate(team.id);
    }
  };

  const getAutoAssignLabel = (mode: string) => {
    switch (mode) {
      case "round_robin":
        return { label: "Fila Automática (Round Robin)", variant: "secondary" as const };
      case "least_busy":
        return { label: "Menor Carga (Least Busy)", variant: "default" as const };
      default:
        return { label: "Manual", variant: "outline" as const };
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="border-b px-8 py-6 flex items-center justify-between shrink-0 bg-background">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Equipes e Setores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure setores e a distribuição automática de conversas para os agentes.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova equipe
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !teams || teams.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>Nenhuma equipe cadastrada.</p>
                <p className="text-sm mt-1">Clique em "Nova equipe" para criar o primeiro setor.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Distribuição</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((t: any) => {
                    const assignConfig = getAutoAssignLabel(t.auto_assign_mode);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-semibold text-foreground">
                          {t.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {t.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignConfig.variant}>{assignConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <UsersIcon className="h-3 w-3" />
                            {t.member_count || 0} {t.member_count === 1 ? "membro" : "membros"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Gerenciar membros"
                              onClick={() => setMembersTeam(t)}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Editar equipe"
                              onClick={() => handleEdit(t)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(t)}
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

      <TeamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        team={editingTeam}
        onSuccess={invalidate}
      />

      <TeamMembersDialog
        team={membersTeam}
        onOpenChange={(o) => !o && setMembersTeam(null)}
        onSuccess={invalidate}
      />
    </div>
  );
}

function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any;
  onSuccess: () => void;
}) {
  const createTeamFn = useServerFn(createTeam);
  const createMut = useMutation({
    mutationFn: (payload: { data: { name: string; description: string | null; autoAssignMode: "manual" | "round_robin" | "least_busy" } }) => createTeamFn(payload),
    onSuccess: () => {
      toast.success("Equipe criada com sucesso!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao criar equipe: " + err.message);
    },
  });

  const updateTeamFn = useServerFn(updateTeam);
  const updateMut = useMutation({
    mutationFn: (payload: { data: { id: any; name: string; description: string | null; autoAssignMode: "manual" | "round_robin" | "least_busy" } }) => updateTeamFn(payload),
    onSuccess: () => {
      toast.success("Equipe atualizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar equipe: " + err.message);
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [autoAssignMode, setAutoAssignMode] = useState<"manual" | "round_robin" | "least_busy">("manual");

  useEffect(() => {
    if (open) {
      if (team) {
        setName(team.name || "");
        setDescription(team.description || "");
        setAutoAssignMode(team.auto_assign_mode || "manual");
      } else {
        setName("");
        setDescription("");
        setAutoAssignMode("manual");
      }
    }
  }, [open, team]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (team) {
      updateMut.mutate({
        data: {
          id: team.id,
          name: name.trim(),
          description: description.trim() || null,
          autoAssignMode,
        },
      });
    } else {
      createMut.mutate({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          autoAssignMode,
        },
      });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{team ? "Editar equipe / setor" : "Criar nova equipe"}</DialogTitle>
            <DialogDescription>
              Setores servem para categorizar conversas e distribuir atendimentos para os agentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="team-name">Nome do setor *</Label>
              <Input
                id="team-name"
                required
                placeholder="Ex: Comercial, Suporte Técnico, Financeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="team-desc">Descrição</Label>
              <Input
                id="team-desc"
                placeholder="Breve descrição do setor"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="assign-mode">Modo de atribuição automática</Label>
              <Select
                value={autoAssignMode}
                onValueChange={(val: any) => setAutoAssignMode(val)}
              >
                <SelectTrigger id="assign-mode">
                  <SelectValue placeholder="Selecione o modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Agente escolhe/supervisor atribui)</SelectItem>
                  <SelectItem value="round_robin">Fila automática (Round-Robin / Fila circular)</SelectItem>
                  <SelectItem value="least_busy">Menor Carga (Least-Busy / Agente mais livre)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamMembersDialog({
  team,
  onOpenChange,
  onSuccess,
}: {
  team: any;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listTeamMembers);
  const fetchUsersFn = useServerFn(listUsers);
  
  const addTeamMemberFn = useServerFn(addTeamMember);
  const addMemberMut = useMutation({
    mutationFn: (payload: { data: { teamId: any; userId: string; role: "agent" | "supervisor" } }) => addTeamMemberFn(payload),
    onSuccess: () => {
      toast.success("Membro adicionado!");
      qc.invalidateQueries({ queryKey: ["team-members", team?.id] });
      onSuccess();
    },
    onError: (err: any) => {
      toast.error("Erro ao adicionar membro: " + err.message);
    },
  });

  const removeTeamMemberFn = useServerFn(removeTeamMember);
  const removeMemberMut = useMutation({
    mutationFn: (payload: { data: { teamId: any; userId: string } }) => removeTeamMemberFn(payload),
    onSuccess: () => {
      toast.success("Membro removido!");
      qc.invalidateQueries({ queryKey: ["team-members", team?.id] });
      onSuccess();
    },
    onError: (err: any) => {
      toast.error("Erro ao remover membro: " + err.message);
    },
  });

  // Carrega membros da equipe atual
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", team?.id],
    queryFn: () => fetchMembers({ data: { teamId: team.id } }),
    enabled: !!team,
  });

  // Carrega todos os agentes cadastrados no Supabase auth
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsersFn({}),
  });

  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState<"agent" | "supervisor">("agent");

  // Filtra usuários da plataforma que AINDA NÃO fazem parte do time
  const availableUsers = (usersData?.users ?? []).filter((u: any) => {
    if (!members) return true;
    return !members.some((m: any) => m.user_id === u.id);
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !selectedUserId) return;
    addMemberMut.mutate({
      data: {
        teamId: team.id,
        userId: selectedUserId,
        role,
      },
    });
    setSelectedUserId("");
  };

  const handleRemove = (userId: string) => {
    if (!team) return;
    removeMemberMut.mutate({
      data: {
        teamId: team.id,
        userId,
      },
    });
  };

  return (
    <Dialog open={!!team} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" /> Membros da equipe: {team?.name}
          </DialogTitle>
          <DialogDescription>
            Defina quais agentes pertencem a este setor e qual a função deles (agente ou supervisor).
          </DialogDescription>
        </DialogHeader>

        {/* Form para Adicionar Novo Membro */}
        <form onSubmit={handleAdd} className="flex gap-3 items-end p-4 bg-muted/30 rounded-lg border">
          <div className="flex-1 space-y-1">
            <Label htmlFor="select-user">Agente da Plataforma</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="select-user">
                <SelectValue placeholder="Selecione o usuário" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum agente extra disponível
                  </SelectItem>
                ) : (
                  availableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px] space-y-1">
            <Label htmlFor="select-member-role">Cargo na equipe</Label>
            <Select value={role} onValueChange={(val: any) => setRole(val)}>
              <SelectTrigger id="select-member-role">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agente (Atendimento)</SelectItem>
                <SelectItem value="supervisor">Supervisor (Gestão)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!selectedUserId || addMemberMut.isPending}>
            {addMemberMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </>
            )}
          </Button>
        </form>

        {/* Tabela de Membros Atuais */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Membros vinculados</h4>
          {membersLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !members || members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              Nenhum membro nesta equipe ainda. Use o formulário acima para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo na Equipe</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.email}</TableCell>
                    <TableCell className="font-medium">
                      {m.full_name || m.display_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "supervisor" ? "secondary" : "outline"}>
                        {m.role === "supervisor" ? "Supervisor" : "Agente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={removeMemberMut.isPending}
                        onClick={() => handleRemove(m.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
