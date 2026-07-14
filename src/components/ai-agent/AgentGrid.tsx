import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateAgent, deleteAgent, duplicateAgent } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, ArrowLeft, MoreVertical, Copy, Pencil, Trash2, BrainCircuit, Activity } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function AgentGrid({ 
  folderId,
  folderName,
  agents,
  onBack,
  onNewAgent,
  onEditAgent
}: { 
  folderId: string | null;
  folderName: string;
  agents: any[];
  onBack: () => void;
  onNewAgent: () => void;
  onEditAgent: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const updateAgentFn = useServerFn(updateAgent);
  const deleteAgentFn = useServerFn(deleteAgent);
  const duplicateAgentFn = useServerFn(duplicateAgent);

  const [search, setSearch] = useState("");
  const [deletingAgent, setDeletingAgent] = useState<any>(null);

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await updateAgentFn({ data: { id, status } });
      if (!res.ok) throw new Error("Erro ao atualizar status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agents"] });
      toast.success("Status atualizado");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteAgentFn({ data: { id } });
      if (!res.ok) throw new Error("Erro ao excluir agente");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agents"] });
      setDeletingAgent(null);
      toast.success("Agente excluído");
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await duplicateAgentFn({ data: { id } });
      if (!res.ok) throw new Error("Erro ao duplicar agente");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agents"] });
      queryClient.invalidateQueries({ queryKey: ["ds-agent-folders"] });
      toast.success("Agente duplicado com sucesso!");
    },
    onError: (err: any) => toast.error(err?.message || "Falha ao duplicar agente"),
  });

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">{folderName}</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar agentes..." 
            className="pl-9 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={onNewAgent} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Adicionar Agente
        </Button>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-background text-center">
          <BrainCircuit className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-lg font-semibold">Nenhum agente encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Você ainda não possui agentes nesta pasta.
          </p>
          <Button onClick={onNewAgent} variant="outline">
            Criar Primeiro Agente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => (
            <Card key={agent.id} className="p-5 flex flex-col hover:shadow-md transition-shadow bg-background">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{agent.provider}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditAgent(agent.id)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateMut.mutate(agent.id)} disabled={duplicateMut.isPending}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:bg-destructive/10"
                      onClick={() => setDeletingAgent(agent)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                <Badge variant={agent.status === "active" ? "default" : "secondary"} className="gap-1">
                  {agent.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  {agent.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => toggleStatusMut.mutate({ id: agent.id, status: agent.status === "active" ? "inactive" : "active" })}
                >
                  <Activity className="h-3 w-3" />
                  {agent.status === "active" ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deletingAgent} onOpenChange={(o) => !o && setDeletingAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir Agente
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o agente <strong>{deletingAgent?.name}</strong>? Esta ação é irreversível e apagará todo o conhecimento e treinamentos associados a ele.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletingAgent(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate(deletingAgent.id)}>
              Sim, excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
