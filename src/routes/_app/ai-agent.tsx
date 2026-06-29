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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, BrainCircuit, Key, Save } from "lucide-react";
import {
  getAiAgentSettings,
  saveAiAgentSettings,
  getKnowledgeBase,
  saveKnowledgeBase,
  deleteKnowledgeBase,
} from "@/lib/ai-agent.functions";
import { toast } from "sonner";

// @ts-ignore
export const Route = createFileRoute("/_app/ai-agent")({
  component: AiAgentPage,
});

function AiAgentPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getAiAgentSettings);
  const saveSettingsFn = useServerFn(saveAiAgentSettings);
  const getKbFn = useServerFn(getKnowledgeBase);
  const saveKbFn = useServerFn(saveKnowledgeBase);
  const deleteKbFn = useServerFn(deleteKnowledgeBase);

  const [isKbDialogOpen, setIsKbDialogOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<any>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [model, setModel] = useState<string>("gemini-2.5-flash");

  const settingsQuery = useQuery({
    queryKey: ["aiSettings"],
    queryFn: () => getSettingsFn(),
  });

  const kbQuery = useQuery({
    queryKey: ["knowledgeBase"],
    queryFn: () => getKbFn(),
  });

  const saveSettings = useMutation({
    mutationFn: async (payload: any) => {
      const res = await saveSettingsFn({ data: payload });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiSettings"] });
      toast.success("Configurações do Agente salvas com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveKb = useMutation({
    mutationFn: async (payload: any) => {
      const res = await saveKbFn({ data: payload });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBase"] });
      setIsKbDialogOpen(false);
      toast.success("Documento salvo na base de conhecimento.");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteKb = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteKbFn({ data: { id } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeBase"] });
      toast.success("Documento removido.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveSettings.mutate({
      is_active: isActive,
      api_key: fd.get("api_key") || null,
      model: model,
      system_prompt: fd.get("system_prompt"),
    });
  };

  const handleSaveKb = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveKb.mutate({
      id: editingKb?.id,
      title: fd.get("title"),
      content: fd.get("content"),
    });
  };

  const settings = settingsQuery.data?.settings;
  const kbDocs = kbQuery.data || [];

  useEffect(() => {
    if (settings) {
      setIsActive(!!settings.is_active);
      setModel(settings.model || "gemini-2.5-flash");
    }
  }, [settings]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Agente de IA (AI Agent)"
        subtitle="Configure a inteligência artificial para atendimento automático e humanizado."
      />

      {settingsQuery.isLoading ? (
        <p>Carregando configurações...</p>
      ) : settingsQuery.data?.ok === false ? (
        <Card>
          <CardContent className="pt-6 text-destructive">{settingsQuery.data.error}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Configurações do Agente */}
          <Card className="col-span-1">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <BrainCircuit className="h-5 w-5 text-purple-500" />
                <CardTitle>Configurações do Cérebro</CardTitle>
              </div>
              <CardDescription>
                Ative o agente e defina sua personalidade e integração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-base">Agente IA Ativo</Label>
                    <p className="text-sm text-muted-foreground">
                      Se ligado, a IA responderá quando o BotFlow não souber o que dizer.
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="h-4 w-4" /> Chave da API (Google Gemini)
                  </Label>
                  <Input
                    name="api_key"
                    type="password"
                    placeholder="AIzaSy..."
                    defaultValue={settings?.api_key || ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    Necessário para que o Agente consiga conversar. Deixe em branco se configurado
                    no servidor.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modelo de IA</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-flash">
                        Gemini 2.5 Flash (Rápido e Barato)
                      </SelectItem>
                      <SelectItem value="gemini-2.5-pro">
                        Gemini 2.5 Pro (Avançado e Caro)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prompt de Sistema (Persona)</Label>
                  <Textarea
                    name="system_prompt"
                    rows={8}
                    defaultValue={settings?.system_prompt || ""}
                    placeholder="Você é um assistente da empresa X. Sempre seja educado e use emojis..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Instruções primárias para o modelo sobre como agir.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={saveSettings.isPending}>
                  {saveSettings.isPending ? (
                    "Salvando..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> Salvar Configurações
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Base de Conhecimento */}
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Base de Conhecimento (RAG)</CardTitle>
                <CardDescription>
                  Textos que a IA vai consultar para responder perguntas.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingKb(null);
                  setIsKbDialogOpen(true);
                }}
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {kbQuery.isLoading ? (
                <p>Carregando documentos...</p>
              ) : kbDocs.length === 0 ? (
                <div className="text-center py-10">
                  <h3 className="mt-4 text-sm font-semibold">Base Vazia</h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    A IA responderá apenas com base no seu conhecimento geral e no Prompt.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kbDocs.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingKb(doc);
                              setIsKbDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteKb.mutate(doc.id)}
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
        </div>
      )}

      {/* Modal de Knowledge Base */}
      <Dialog open={isKbDialogOpen} onOpenChange={setIsKbDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSaveKb}>
            <DialogHeader>
              <DialogTitle>{editingKb ? "Editar Documento" : "Novo Documento"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título / Assunto</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={editingKb?.title || ""}
                  placeholder="Ex: Política de Troca e Devolução"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo (Texto)</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={editingKb?.content || ""}
                  rows={10}
                  placeholder="Copie e cole aqui as informações que a IA deve saber sobre este assunto..."
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsKbDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveKb.isPending}>
                {saveKb.isPending ? "Salvando..." : "Salvar Documento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
