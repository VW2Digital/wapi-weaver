import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Bot as BotIcon, Power } from "lucide-react";
import {
  getBotSettings,
  toggleBotStatus,
  listBotSteps,
  saveBotStep,
  deleteBotStep,
} from "@/lib/botflow.functions";
import { toast } from "sonner";

// @ts-ignore
export const Route = createFileRoute("/_app/bot")({
  component: BotPage,
});

function BotPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getBotSettings);
  const toggleStatusFn = useServerFn(toggleBotStatus);
  const listStepsFn = useServerFn(listBotSteps);
  const saveStepFn = useServerFn(saveBotStep);
  const deleteStepFn = useServerFn(deleteBotStep);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [currentMessageType, setCurrentMessageType] = useState<string>("text");

  const settingsQuery = useQuery({
    queryKey: ["botSettings"],
    queryFn: () => getSettingsFn(),
  });

  const stepsQuery = useQuery({
    queryKey: ["botSteps"],
    queryFn: () => listStepsFn(),
  });

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

  const saveStep = useMutation({
    mutationFn: async (payload: any) => {
      const res = await saveStepFn({ data: payload });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSteps"] });
      setIsDialogOpen(false);
      toast.success("Passo salvo com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteStepFn({ data: { id } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botSteps"] });
      toast.success("Passo excluído");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEdit = (step: any) => {
    setEditingStep(step);
    setCurrentMessageType(step.message_type || "text");
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStep(null);
    setCurrentMessageType("text");
    setIsDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    let parsedButtons = null;
    if (fd.get("buttons_config")) {
      try {
        parsedButtons = JSON.parse(fd.get("buttons_config") as string);
      } catch (err) {
        toast.error("O JSON de configuração de botões é inválido.");
        return;
      }
    }

    saveStep.mutate({
      id: editingStep?.id,
      step_order: Number(fd.get("step_order")),
      trigger_type: fd.get("trigger_type"),
      trigger_value: fd.get("trigger_value"),
      message_type: fd.get("message_type"),
      message_content: fd.get("message_content"),
      media_url: fd.get("media_url"),
      media_caption: fd.get("media_caption"),
      buttons_config: parsedButtons,
      next_step_id: fd.get("next_step_id") || null,
    });
  };

  const settings = settingsQuery.data?.settings;
  const steps = stepsQuery.data || [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Bot de Fluxo (BotFlow)"
        subtitle="Crie e gerencie os fluxos automáticos de atendimento."
      />

      {settingsQuery.isLoading ? (
        <p>Carregando configurações...</p>
      ) : settingsQuery.data?.ok === false ? (
        <Card>
          <CardContent className="pt-6 text-destructive">{settingsQuery.data.error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status do Bot</CardTitle>
                <Power className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-2xl font-bold">
                    {settings?.is_active ? (
                      <span className="text-green-500">Ligado</span>
                    ) : (
                      <span className="text-muted-foreground">Desligado</span>
                    )}
                  </div>
                  <Switch
                    checked={settings?.is_active}
                    onCheckedChange={(checked) => toggleStatus.mutate(checked)}
                    disabled={toggleStatus.isPending}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Se ligado, ele interceptará mensagens baseando-se nos passos abaixo.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Passos do Fluxo</CardTitle>
                <CardDescription>Configure a sequência de mensagens do robô.</CardDescription>
              </div>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Passo
              </Button>
            </CardHeader>
            <CardContent>
              {stepsQuery.isLoading ? (
                <p>Carregando passos...</p>
              ) : steps.length === 0 ? (
                <div className="text-center py-10">
                  <BotIcon className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum passo configurado</h3>
                  <p className="text-muted-foreground">Crie o primeiro passo para o seu bot.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Ordem</TableHead>
                      <TableHead>Gatilho (Trigger)</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Próximo Passo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.map((step: any) => (
                      <TableRow key={step.id}>
                        <TableCell className="font-medium">{step.step_order}</TableCell>
                        <TableCell>
                          <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold uppercase mr-2">
                            {step.trigger_type}
                          </span>
                          {step.trigger_value}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={step.message_content}>
                          {step.message_content}
                        </TableCell>
                        <TableCell>
                          {step.next_step_id ? (
                            <span className="text-xs text-muted-foreground">
                              Ir para Ordem{" "}
                              {steps.find((s: any) => s.id === step.next_step_id)?.step_order ||
                                "?"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Aguardar usuário</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(step)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteStep.mutate(step.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingStep ? "Editar Passo" : "Novo Passo"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="step_order" className="text-right">
                  Ordem
                </Label>
                <Input
                  id="step_order"
                  name="step_order"
                  type="number"
                  defaultValue={
                    editingStep?.step_order ||
                    (steps.length > 0 ? Math.max(...steps.map((s: any) => s.step_order)) + 1 : 1)
                  }
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="trigger_type" className="text-right">
                  Tipo de Gatilho
                </Label>
                <div className="col-span-3">
                  <Select name="trigger_type" defaultValue={editingStep?.trigger_type || "keyword"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">START (Primeira Mensagem)</SelectItem>
                      <SelectItem value="keyword">KEYWORD (Palavra Chave)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="trigger_value" className="text-right">
                  Valor / Palavra
                </Label>
                <Input
                  id="trigger_value"
                  name="trigger_value"
                  defaultValue={editingStep?.trigger_value || ""}
                  className="col-span-3"
                  placeholder="Ex: 1, sim, iniciar..."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="message_type" className="text-right">
                  Tipo de Mensagem
                </Label>
                <div className="col-span-3">
                  <Select
                    name="message_type"
                    value={currentMessageType}
                    onValueChange={setCurrentMessageType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                      <SelectItem value="interactive">Interativo (Botões/Lista)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="message_content" className="text-right">
                  Texto Principal
                </Label>
                <Textarea
                  id="message_content"
                  name="message_content"
                  defaultValue={editingStep?.message_content || ""}
                  className="col-span-3"
                  rows={4}
                  required={currentMessageType === "text"}
                />
              </div>

              {["image", "audio", "video", "document"].includes(currentMessageType) && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="media_url" className="text-right">
                      URL da Mídia
                    </Label>
                    <Input
                      id="media_url"
                      name="media_url"
                      type="url"
                      defaultValue={editingStep?.media_url || ""}
                      className="col-span-3"
                      placeholder="https://..."
                      required
                    />
                  </div>
                  {currentMessageType !== "audio" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="media_caption" className="text-right">
                        Legenda (Opcional)
                      </Label>
                      <Input
                        id="media_caption"
                        name="media_caption"
                        defaultValue={editingStep?.media_caption || ""}
                        className="col-span-3"
                      />
                    </div>
                  )}
                </>
              )}

              {currentMessageType === "interactive" && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="buttons_config" className="text-right mt-2">
                    Config. Botões (JSON)
                  </Label>
                  <Textarea
                    id="buttons_config"
                    name="buttons_config"
                    defaultValue={
                      editingStep?.buttons_config
                        ? JSON.stringify(editingStep.buttons_config, null, 2)
                        : ""
                    }
                    className="col-span-3 font-mono text-sm"
                    rows={6}
                    placeholder='{"type":"button","body":{"text":"Escolha:"},"action":{"buttons":[{"type":"reply","reply":{"id":"1","title":"Sim"}}]}}'
                  />
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="next_step_id" className="text-right">
                  Próximo Passo Auto
                </Label>
                <div className="col-span-3">
                  <Select name="next_step_id" defaultValue={editingStep?.next_step_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o próximo (Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(Nenhum - Aguardar Interação)</SelectItem>
                      <SelectItem value="-999" className="text-destructive font-semibold">
                        🔴 TRANSFERIR PARA HUMANO (Handoff)
                      </SelectItem>
                      {steps.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.step_order} - {s.trigger_value || s.trigger_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveStep.isPending}>
                {saveStep.isPending ? "Salvando..." : "Salvar Passo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
