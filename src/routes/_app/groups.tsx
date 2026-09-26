import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createWhatsAppGroup,
  listWhatsAppGroups,
  archiveWhatsAppGroup,
  deleteWhatsAppGroup,
  resetWhatsAppGroupInviteLink,
  syncWhatsAppGroupsFromMeta,
  getGroupsEligibility,
} from "@/lib/groups.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  Copy,
  Check,
  Archive,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  Link2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppGroupRecord {
  id: string;
  group_id: string;
  name?: string | null;
  description?: string | null;
  invite_link?: string | null;
  status?: string | null;
  created_at?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

function GroupsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchGroups = useServerFn(listWhatsAppGroups);
  const createGroup = useServerFn(createWhatsAppGroup);
  const archiveGroup = useServerFn(archiveWhatsAppGroup);
  const deleteGroup = useServerFn(deleteWhatsAppGroup);
  const resetInvite = useServerFn(resetWhatsAppGroupInviteLink);
  const syncGroups = useServerFn(syncWhatsAppGroupsFromMeta);
  const fetchEligibility = useServerFn(getGroupsEligibility);

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [joinApproval, setJoinApproval] = useState<"auto_approve" | "approval_required">(
    "auto_approve",
  );
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  const eligibilityQuery = useQuery({
    queryKey: ["whatsapp-groups-eligibility"],
    queryFn: () => fetchEligibility(),
  });

  const groupsQuery = useQuery({
    queryKey: ["whatsapp-groups", search],
    queryFn: () => fetchGroups({ data: { search } }),
    enabled: eligibilityQuery.data?.enabled !== false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      join_approval_mode?: "auto_approve" | "approval_required";
    }) => createGroup({ data: payload }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(
          res.data?.invite_link
            ? "Grupo criado na Meta. Envie o link de convite para os participantes."
            : "Grupo criado. O link de convite chega pelo webhook de ciclo de vida.",
        );
        setIsCreateOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
        qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
        qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      } else {
        toast.error(res.error?.message || "Erro ao criar grupo.");
      }
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err) || "Falha na requisição.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveGroup({ data: { id } }),
    onSuccess: () => {
      toast.success("Grupo arquivado no painel.");
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err) || "Erro ao arquivar grupo.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup({ data: { id } }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error?.message || "Falha ao excluir na Meta.");
        return;
      }
      toast.success("Grupo excluído na Meta.");
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => resetInvite({ data: { id } }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error?.message || "Falha ao resetar o convite.");
        return;
      }
      toast.success("Novo link de convite gerado. Links anteriores ficaram inválidos.");
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncGroups(),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error?.message || "Falha ao sincronizar.");
        return;
      }
      toast.success(`${res.upserted ?? 0} grupo(s) sincronizado(s) da Meta.`);
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
  });

  const handleCopyLink = (groupId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedGroupId(groupId);
    toast.success("Link de convite copiado!");
    setTimeout(() => setCopiedGroupId(null), 2000);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createMutation.mutate({
      name: newGroupName,
      description: newGroupDesc,
      join_approval_mode: joinApproval,
    });
  };

  const eligibility = eligibilityQuery.data;
  const groups: WhatsAppGroupRecord[] = groupsQuery.data?.groups ?? [];

  usePageHeader({
    title: "Grupos de WhatsApp",
    subtitle:
      "Groups API: convite por link, até 8 participantes, 10.000 grupos por número. Requer OBA. Chamadas não são suportadas.",
    action: (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || eligibility?.eligible === false}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar
        </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={eligibility?.eligible === false}>
              <Plus className="h-4 w-4 mr-2" /> Novo grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md border-border">
            <DialogHeader>
              <DialogTitle>Criar grupo na Meta</DialogTitle>
              <DialogDescription>
                Participantes entram só pelo link de convite. Não é possível adicionar números
                manualmente. Máximo 8 participantes. Tipos suportados: texto, mídia e templates.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label htmlFor="groupName" className="text-xs font-semibold">
                  Assunto do grupo *
                </label>
                <Input
                  id="groupName"
                  required
                  placeholder="Ex: Consulta de compra"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={128}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="groupDesc" className="text-xs font-semibold">
                  Descrição (opcional)
                </label>
                <Textarea
                  id="groupDesc"
                  placeholder="Contexto do grupo para quem recebe o convite"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows={3}
                  maxLength={2048}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="joinMode" className="text-xs font-semibold">
                  Pedidos de entrada
                </label>
                <select
                  id="joinMode"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={joinApproval}
                  onChange={(e) =>
                    setJoinApproval(e.target.value as "auto_approve" | "approval_required")
                  }
                >
                  <option value="auto_approve">Entrada automática pelo link</option>
                  <option value="approval_required">Exigir aprovação</option>
                </select>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar grupo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    ),
  });

  if (eligibilityQuery.isLoading) {
    return <div className="h-full bg-background animate-pulse" />;
  }

  if (eligibility && eligibility.enabled === false) {
    return (
      <div className="flex h-full flex-col p-6 items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Módulo desativado</CardTitle>
            <CardDescription className="mt-2 text-muted-foreground text-sm">
              {eligibility.reason ||
                "O gerenciamento de grupos do WhatsApp não está ativo nesta instalação."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {eligibility?.eligible === false ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Eligibility for Groups API</CardTitle>
              <CardDescription>
                {eligibility.reason ||
                  "A Groups API está aberta a negócios com Official Business Account (OBA). Números da WhatsApp Business app e Multi-solution Conversations não são elegíveis. Calling API não funciona em grupos."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <p className="text-xs text-muted-foreground max-w-3xl">
            Convite exclusivo por link. Mensagens não suportadas: chamadas, desaparecimento,
            visualização única, autenticação, commerce e interativas. Preço por mensagem.
            Templates de grupo devem ser específicos (métricas de template 1:1 não se aplicam).
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupo pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-border bg-card"
            />
          </div>
        </div>

        {groupsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-card/50 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Nenhum grupo encontrado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Crie um grupo na Cloud API ou sincronize os grupos ativos deste número.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className={cn(
                  "border-border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden bg-card",
                  (group.status === "archived" || group.status === "deleted") && "opacity-75",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-bold truncate text-foreground flex items-center gap-2">
                        {group.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate mt-0.5">
                        {group.group_id}
                      </CardDescription>
                    </div>
                    <span className="shrink-0 bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-extrabold uppercase select-none">
                      {group.status === "active"
                        ? "Ativo"
                        : group.status === "deleted"
                          ? "Excluído"
                          : "Arquivado"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-muted-foreground line-clamp-2 min-h-8">
                    {group.description || "Sem descrição."}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-border">
                    {group.invite_link ? (
                      <div className="flex items-center justify-between bg-muted/65 p-2 rounded-lg gap-2">
                        <span className="truncate text-muted-foreground select-none max-w-[190px]">
                          {group.invite_link}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full shrink-0"
                          onClick={() => handleCopyLink(group.id, group.invite_link as string)}
                        >
                          {copiedGroupId === group.id ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Link de convite pendente (webhook group_lifecycle_update).
                      </p>
                    )}
                  </div>
                </CardContent>
                <div className="p-4 bg-muted/20 border-t border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
                  {group.status === "active" ? (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 h-8"
                        onClick={() => resetMutation.mutate(group.id)}
                        disabled={resetMutation.isPending}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Novo convite
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 h-8"
                        onClick={() => archiveMutation.mutate(group.id)}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 text-xs px-2 h-8"
                        onClick={() => deleteMutation.mutate(group.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic pl-1">Inativo</span>
                  )}

                  <Button
                    size="sm"
                    className="text-xs px-3 h-8 font-semibold"
                    onClick={() =>
                      navigate({
                        to: "/chat",
                        search: { phone: group.group_id, contactId: undefined },
                      })
                    }
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Conversar{" "}
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/groups")({
  component: GroupsPage,
});
