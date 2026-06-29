import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createWhatsAppGroup,
  listWhatsAppGroups,
  archiveWhatsAppGroup,
} from "@/lib/groups.functions";
import { getProfile } from "@/lib/profile.functions";
import { PageHeader } from "@/components/layout/page-header";
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
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchGroups = useServerFn(listWhatsAppGroups);
  const createGroup = useServerFn(createWhatsAppGroup);
  const archiveGroup = useServerFn(archiveWhatsAppGroup);
  const fetchProfile = useServerFn(getProfile);

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const groupsQuery = useQuery({
    queryKey: ["whatsapp-groups", search],
    queryFn: () => fetchGroups({ data: { search } }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      createGroup({ data: payload }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Grupo criado com sucesso!");
        setIsCreateOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
        qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
        qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      } else {
        toast.error(res.error?.message || "Erro ao criar grupo.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha na requisição.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveGroup({ data: { id } }),
    onSuccess: () => {
      toast.success("Grupo arquivado!");
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao arquivar grupo.");
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
    createMutation.mutate({ name: newGroupName, description: newGroupDesc });
  };

  // Se o módulo estiver desativado no perfil ou nas variáveis de ambiente
  const isEnabled = process.env.WHATSAPP_GROUPS_ENABLED === "true";

  if (!isEnabled) {
    return (
      <div className="flex h-full flex-col p-6 items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Módulo Desativado</CardTitle>
            <CardDescription className="mt-2 text-muted-foreground text-sm">
              O gerenciamento de grupos do WhatsApp oficial não está ativo nesta instalação do Bliv.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para ativar esta funcionalidade, configure a variável de ambiente{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">
                WHATSAPP_GROUPS_ENABLED=true
              </code>{" "}
              e reinicie a aplicação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groups = groupsQuery.data?.groups || [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="p-6 shrink-0 border-b border-border bg-card">
        <PageHeader
          title="Grupos de WhatsApp"
          description="Crie e gerencie grupos oficiais do WhatsApp diretamente pela API Cloud da Meta."
        >
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#FF424E] to-[#FFA554] text-white hover:opacity-90 shadow-md">
                <Plus className="h-4 w-4 mr-2" /> Novo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-border">
              <DialogHeader>
                <DialogTitle>Criar Novo Grupo</DialogTitle>
                <DialogDescription>
                  Insira as informações básicas para criar o grupo no WhatsApp oficial da Meta.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="groupName" className="text-xs font-semibold">
                    Nome do Grupo *
                  </label>
                  <Input
                    id="groupName"
                    required
                    placeholder="Ex: Suporte VIP Bliv"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    maxLength={25}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="groupDesc" className="text-xs font-semibold">
                    Descrição (Opcional)
                  </label>
                  <Textarea
                    id="groupDesc"
                    placeholder="Adicione um propósito ou regras para o grupo..."
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    rows={3}
                  />
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
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-[#FF424E] to-[#FFA554] text-white hover:opacity-90"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Grupo"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </PageHeader>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* Barra de filtros */}
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
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Crie um novo grupo para gerenciar ou simular participantes oficiais.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group: any) => (
              <Card
                key={group.id}
                className={cn(
                  "border-border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden bg-card",
                  group.status === "archived" && "opacity-75"
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
                    <span className="shrink-0 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase select-none">
                      {group.status === "active" ? "Ativo" : "Arquivado"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-muted-foreground line-clamp-2 min-h-8">
                    {group.description || "Nenhuma descrição fornecida."}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-border">
                    {group.invite_link && (
                      <div className="flex items-center justify-between bg-muted/65 p-2 rounded-lg gap-2">
                        <span className="truncate text-muted-foreground select-none max-w-[190px]">
                          {group.invite_link}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full shrink-0"
                          onClick={() => handleCopyLink(group.id, group.invite_link)}
                        >
                          {copiedGroupId === group.id ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Criado em:</span>
                      <span className="font-semibold text-foreground">
                        {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-2 shrink-0">
                  {group.status === "active" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 text-xs px-2.5 h-8 font-semibold"
                      onClick={() => archiveMutation.mutate(group.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Arquivar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic pl-1">Grupo Arquivado</span>
                  )}

                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 h-8 font-semibold"
                    onClick={() => navigate({ to: `/chat`, search: { phone: group.group_id } as any })}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Conversar <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
