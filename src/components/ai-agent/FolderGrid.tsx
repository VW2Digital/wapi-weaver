import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFolder, updateFolder, deleteFolder } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Plus, Folder, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function FolderGrid({ 
  folders, 
  agents,
  onOpenFolder,
  onNewAgent,
  onEditAgent
}: { 
  folders: any[], 
  agents: any[],
  onOpenFolder: (id: string | null) => void,
  onNewAgent: () => void,
  onEditAgent: (id: string) => void
}) {
  const queryClient = useQueryClient();
  const createFolderFn = useServerFn(createFolder);
  const updateFolderFn = useServerFn(updateFolder);
  const deleteFolderFn = useServerFn(deleteFolder);

  const [search, setSearch] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  
  const [editingFolder, setEditingFolder] = useState<any>(null);
  
  const [deletingFolder, setDeletingFolder] = useState<any>(null);
  const [deleteAgents, setDeleteAgents] = useState(false);

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await createFolderFn({ data: { name } });
      if (!res.ok) throw new Error("Erro ao criar pasta");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agent-folders"] });
      setIsNewOpen(false);
      setFolderName("");
      toast.success("Pasta criada");
    },
    onError: (err: any) => toast.error(err?.message || "Falha ao criar pasta"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await updateFolderFn({ data: { id, name } });
      if (!res.ok) throw new Error("Erro ao atualizar pasta");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agent-folders"] });
      setEditingFolder(null);
      toast.success("Pasta atualizada");
    },
    onError: (err: any) => toast.error(err?.message || "Falha ao atualizar pasta"),
  });

  const deleteMut = useMutation({
    mutationFn: async ({ id, delAgents }: { id: string; delAgents: boolean }) => {
      const res = await deleteFolderFn({ data: { id, deleteAgents: delAgents } });
      if (!res.ok) throw new Error("Erro ao excluir pasta");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ds-agent-folders"] });
      queryClient.invalidateQueries({ queryKey: ["ds-agents"] });
      setDeletingFolder(null);
      toast.success("Pasta excluída");
    },
    onError: (err: any) => toast.error(err?.message || "Falha ao excluir pasta"),
  });

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const unassignedAgents = agents.filter(a => !a.folder_id);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar pastas..." 
            className="pl-9 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsNewOpen(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> Nova Pasta
          </Button>
          <Button onClick={onNewAgent} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> Novo Agente
          </Button>
        </div>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <AlertDescription className="text-primary font-medium">
          Selecione uma pasta para visualizar e organizar seus agentes de Inteligência Artificial.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Special Folder for Unassigned Agents */}
        <Card 
          className="group relative flex flex-col p-5 hover:shadow-md transition-all cursor-pointer bg-background border-dashed"
          onClick={() => onOpenFolder(null)}
        >
          <div className="flex items-start justify-between">
            <div className="p-2 bg-muted rounded-lg">
              <Folder className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs font-medium">
              <Users className="h-3 w-3" />
              {unassignedAgents.length}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold text-lg">Agentes Sem Pasta</h3>
            <p className="text-sm text-muted-foreground mt-1">Agentes criados na raiz</p>
          </div>
        </Card>

        {filteredFolders.map(folder => (
          <Card 
            key={folder.id} 
            className="group relative flex flex-col p-5 hover:shadow-md transition-all cursor-pointer bg-background"
            onClick={() => onOpenFolder(folder.id)}
          >
            <div className="flex items-start justify-between">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Folder className="h-6 w-6 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                  <Users className="h-3 w-3" />
                  {folder.agents_count || 0}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={e => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar Nome
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); setDeleteAgents(false); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir Pasta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-semibold text-lg">{folder.name}</h3>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Nome da pasta</Label>
            <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Ex: Vendas, Suporte..." className="mt-1.5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate(folderName)} disabled={!folderName || createMut.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFolder} onOpenChange={(o) => !o && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Novo nome</Label>
            <Input 
              defaultValue={editingFolder?.name} 
              onChange={e => { if (editingFolder) editingFolder.newName = e.target.value; }} 
              className="mt-1.5" 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFolder(null)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate({ id: editingFolder.id, name: editingFolder.newName || editingFolder.name })}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingFolder} onOpenChange={(o) => !o && setDeletingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir Pasta
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a pasta <strong>{deletingFolder?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label>Excluir agentes internos?</Label>
                <p className="text-xs text-muted-foreground">
                  Se desativado, os agentes serão movidos para a raiz (Sem Pasta).
                </p>
              </div>
              <Switch checked={deleteAgents} onCheckedChange={setDeleteAgents} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFolder(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate({ id: deletingFolder.id, delAgents: deleteAgents })}>
              Sim, excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
