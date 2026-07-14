import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTools, saveTool, deleteTool } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Wrench, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

const defaultForm = {
  name: "",
  description: "",
  require_confirmation: true,
  is_active: true,
};

export function ToolsTab({ agentId }: { agentId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTools);
  const saveFn = useServerFn(saveTool);
  const deleteFn = useServerFn(deleteTool);
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ds-tools", agentId],
    queryFn: () => listFn({ data: { agent_id: agentId! } }),
    enabled: !!agentId,
  });

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { agent_id: agentId!, ...form } }),
    onSuccess: () => {
      toast.success("Ferramenta adicionada!");
      qc.invalidateQueries({ queryKey: ["ds-tools", agentId] });
      setOpen(false);
      setForm({ ...defaultForm });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Ferramenta removida");
      qc.invalidateQueries({ queryKey: ["ds-tools", agentId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const toggleActive = useMutation({
    mutationFn: (item: any) => saveFn({ data: { id: item.id, agent_id: agentId!, ...item, is_active: !item.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ds-tools", agentId] }),
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Wrench className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
        <p className="text-muted-foreground text-sm">Crie e salve o agente primeiro para adicionar ferramentas.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ferramentas (Function Calling)</h3>
          <p className="text-sm text-muted-foreground">Vincule ações que o agente pode executar de forma autônoma.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Ferramenta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="border rounded-lg p-12 text-center border-dashed">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm">Nenhuma ferramenta vinculada a este agente.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar primeira ferramenta
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg bg-background hover:shadow-sm transition-shadow">
              <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  {item.require_confirmation && (
                    <Badge variant="outline" className="text-xs">Requer confirmação</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={!!item.is_active}
                onCheckedChange={() => toggleActive.mutate(item)}
                disabled={toggleActive.isPending}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                disabled={deleteMut.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Remover ferramenta?",
                    description: `"${item.name}" será removida permanentemente.`,
                    confirmText: "Remover",
                    destructive: true,
                  });
                  if (ok) deleteMut.mutate(item.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ferramenta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Ferramenta</Label>
              <Input
                placeholder="Ex: buscar_cliente, consultar_estoque"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Use underscores, sem espaços. É o identificador da função.</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                className="min-h-[100px] resize-y"
                placeholder="Descreva quando e como o agente deve usar esta ferramenta..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Requer confirmação humana</Label>
                <p className="text-xs text-muted-foreground">O agente pede aprovação antes de executar.</p>
              </div>
              <Switch
                checked={form.require_confirmation}
                onCheckedChange={c => setForm({ ...form, require_confirmation: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!form.name || !form.description || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
