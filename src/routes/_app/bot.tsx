import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Plus, Save, Trash2, Power } from "lucide-react";
import {
  getBotSettings,
  toggleBotStatus,
  listBotSteps,
  saveBotStepsBatch,
} from "@/lib/botflow.functions";
import { toast } from "sonner";
import { BotFlowCanvas } from "@/components/bot-flow/BotFlowCanvas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// @ts-ignore
export const Route = createFileRoute("/_app/bot")({
  component: BotPage,
});

function BotPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getBotSettings);
  const toggleStatusFn = useServerFn(toggleBotStatus);
  const listStepsFn = useServerFn(listBotSteps);
  const saveStepsBatchFn = useServerFn(saveBotStepsBatch);

  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<any>(null);

  const settingsQuery = useQuery({
    queryKey: ["botSettings"],
    queryFn: () => getSettingsFn(),
  });

  const stepsQuery = useQuery({
    queryKey: ["botSteps"],
    queryFn: () => listStepsFn(),
  });

  useEffect(() => {
    if (stepsQuery.data) {
      setSteps(stepsQuery.data);
    }
  }, [stepsQuery.data]);

  const toggleStatus = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await toggleStatusFn({ data: { isActive } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSettings"] });
      toast.success("Status do bot atualizado");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveBatch = useMutation({
    mutationFn: async (payload: any[]) => {
      const res = await saveStepsBatchFn({ data: payload });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSteps"] });
      toast.success("Fluxo salvo com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAddStep = () => {
    const newStep = {
      id: crypto.randomUUID(),
      step_order: steps.length + 1,
      trigger_type: steps.length === 0 ? "start" : "keyword",
      trigger_value: "",
      message_type: "text",
      message_content: "Nova mensagem",
      position_x: Math.random() * 200 + 100,
      position_y: Math.random() * 200 + 100,
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep);
  };

  const handleUpdateStep = (field: string, value: any) => {
    if (!selectedStep) return;
    const updated = { ...selectedStep, [field]: value };
    setSelectedStep(updated);
    setSteps(steps.map((s) => (s.id === selectedStep.id ? updated : s)));
  };

  const handleDeleteStep = () => {
    if (!selectedStep) return;
    setSteps(steps.filter((s) => s.id !== selectedStep.id));
    setSelectedStep(null);
  };

  const isSettingsActive = settingsQuery.data?.is_active || false;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-none px-6 py-4 border-b bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Construtor de Fluxo</h1>
          <p className="text-sm text-muted-foreground">Arraste e solte para criar seu bot</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-muted-foreground" />
            <Label>Status do Bot</Label>
            <Switch checked={isSettingsActive} onCheckedChange={(c) => toggleStatus.mutate(c)} />
          </div>
          <Button onClick={() => saveBatch.mutate(steps)} disabled={saveBatch.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-4">
          <Button onClick={handleAddStep} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Passo
          </Button>

          <div className="text-xs text-muted-foreground mt-4">
            Dica: Clique em um bloco no painel ao lado para editar suas configurações.
          </div>
        </div>

        {/* CANVAS */}
        <div className="flex-1 relative">
          <BotFlowCanvas steps={steps} onStepsChange={setSteps} onNodeClick={setSelectedStep} />
        </div>

        {/* INSPECTOR */}
        {selectedStep && (
          <div className="w-80 border-l bg-card p-4 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Editar Passo</h3>
              <Button variant="ghost" size="icon" onClick={handleDeleteStep}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Gatilho (Trigger)</Label>
                <Select
                  value={selectedStep.trigger_type}
                  onValueChange={(v) => handleUpdateStep("trigger_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">Início (Start)</SelectItem>
                    <SelectItem value="keyword">Palavra-chave</SelectItem>
                    <SelectItem value="button">Resposta de Botão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedStep.trigger_type === "keyword" && (
                <div className="space-y-2">
                  <Label>Palavra-chave</Label>
                  <Input
                    value={selectedStep.trigger_value || ""}
                    onChange={(e) => handleUpdateStep("trigger_value", e.target.value)}
                    placeholder="Ex: menu, comprar"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Mensagem</Label>
                <Select
                  value={selectedStep.message_type}
                  onValueChange={(v) => handleUpdateStep("message_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="buttons">Botões</SelectItem>
                    <SelectItem value="list">Lista</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo da Mensagem</Label>
                <Textarea
                  value={selectedStep.message_content || ""}
                  onChange={(e) => handleUpdateStep("message_content", e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              {(selectedStep.message_type === "buttons" || selectedStep.message_type === "list") && (
                <div className="space-y-2">
                  <Label>Configuração (JSON)</Label>
                  <Textarea
                    value={
                      typeof selectedStep.buttons_config === "string"
                        ? selectedStep.buttons_config
                        : selectedStep.buttons_config
                          ? JSON.stringify(selectedStep.buttons_config, null, 2)
                          : ""
                    }
                    onChange={(e) => handleUpdateStep("buttons_config", e.target.value)}
                    className="min-h-[120px] font-mono text-xs"
                    placeholder='{"type": "list", "body": {"text": "Selecione..."}}'
                  />
                  <div className="text-xs text-muted-foreground mt-1">Insira o JSON compatível com a API do WhatsApp.</div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Próximo Passo (Fallback)</Label>
                <Select
                  value={selectedStep.next_step_id || "none"}
                  onValueChange={(v) => handleUpdateStep("next_step_id", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Aguarda input)</SelectItem>
                    <SelectItem value="-999">Transferir p/ Atendente</SelectItem>
                    <SelectItem value="-997">Reiniciar (Start)</SelectItem>
                    {steps
                      .filter((s) => s.id !== selectedStep.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Passo {s.step_order} ({s.trigger_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
