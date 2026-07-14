import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgent, createAgent, updateAgent } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Key, Settings, BrainCircuit, Database, Wrench, TestTube, BarChart3, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { TrainingTab } from "./tabs/TrainingTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { TestTab } from "./tabs/TestTab";
import { UsageTab } from "./tabs/UsageTab";
import { IntegrationTab } from "./tabs/IntegrationTab";

interface AgentEditorProps {
  agentId: string | null;
  folderId?: string | null;
  onBack: () => void;
  onCreated?: (id: string) => void;
}

export function AgentEditor({ agentId, folderId, onBack, onCreated }: AgentEditorProps) {
  const queryClient = useQueryClient();
  const getAgentFn = useServerFn(getAgent);
  const createAgentFn = useServerFn(createAgent);
  const updateAgentFn = useServerFn(updateAgent);

  const isNew = !agentId;
  const [currentId, setCurrentId] = useState<string | null>(agentId);
  const [activeTab, setActiveTab] = useState("treinamento");
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [formData, setFormData] = useState<any>({
    name: "Novo Agente",
    provider: "openai",
    model: "gpt-4o-mini",
    status: "inactive",
    api_key: "",
    system_prompt: "",
    folder_id: folderId || null,
    // Settings
    answer_only_assigned: false,
    chunk_responses: false,
    process_images: false,
    process_audio: false,
    disable_outside_hours: false,
    pause_on_human: true,
    wait_time_seconds: 0,
    max_messages_per_interaction: 5,
    temperature: 0.7,
    max_tokens: 1000,
  });

  const { data: agentData, isLoading } = useQuery({
    queryKey: ["ds-agent", currentId],
    queryFn: () => getAgentFn({ data: { id: currentId! } }),
    enabled: !!currentId,
  });

  useEffect(() => {
    if (agentData) {
      setFormData((prev: any) => ({
        ...prev,
        ...agentData,
        api_key: "", // never prefill the key field
        system_prompt: agentData.system_prompt || "",
      }));
    }
  }, [agentData]);

  const updateSystemPrompt = useCallback((prompt: string) => {
    setFormData((prev: any) => ({ ...prev, system_prompt: prompt }));
  }, []);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const res = await createAgentFn({ data: formData });
        return res;
      } else {
        const res = await updateAgentFn({ data: { id: currentId, ...formData } });
        return res;
      }
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["ds-agent-folders"] });
      queryClient.invalidateQueries({ queryKey: ["ds-agents"] });
      toast.success(isNew ? "Agente criado com sucesso!" : "Agente salvo com sucesso!");
      if (isNew && res?.id) {
        setCurrentId(res.id);
        onCreated?.(res.id);
      } else if (!isNew) {
        queryClient.invalidateQueries({ queryKey: ["ds-agent", currentId] });
      }
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar agente"),
  });

  if (!!currentId && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b gap-4 shrink-0">
        <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 max-w-full">
            <BrainCircuit className="h-6 w-6 text-primary shrink-0" />
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="font-bold text-xl h-auto py-1 px-2 border-transparent hover:border-input focus:border-input focus-visible:ring-1 bg-transparent max-w-[200px] sm:max-w-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <Select value={formData.provider} onValueChange={v => setFormData({ ...formData, provider: v })}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
            </SelectContent>
          </Select>

          <Select value={formData.model} onValueChange={v => setFormData({ ...formData, model: v })}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
              <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
              <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
              <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
              <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsApiKeyOpen(true)} title="API Key">
            <Key className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsSettingsOpen(true)} title="Configurações">
            <Settings className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 bg-muted/50 px-3 h-9 rounded-md border">
            <Switch
              checked={formData.status === "active"}
              onCheckedChange={c => setFormData({ ...formData, status: c ? "active" : "inactive" })}
            />
            <span className="text-sm font-medium">{formData.status === "active" ? "Ativo" : "Inativo"}</span>
          </div>

          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="h-9">
            {saveMut.isPending ? (
              <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isNew ? "Criar Agente" : "Salvar"}
          </Button>
        </div>
      </header>

      {/* TABS SIDEBAR LAYOUT */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-muted/10 shrink-0 p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {[
            { id: "treinamento", label: "Treinamento", icon: BrainCircuit },
            { id: "conhecimento", label: "Conhecimento", icon: Database },
            { id: "ferramentas", label: "Ferramentas", icon: Wrench },
            { id: "integracoes", label: "Integrações", icon: Link2 },
            { id: "teste", label: "Teste", icon: TestTube },
            { id: "uso", label: "Uso", icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left shrink-0 md:w-full ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto min-w-0 bg-background ${activeTab !== "treinamento" ? "p-6 md:p-8" : ""}`}>
          {activeTab === "treinamento" && (
            <TrainingTab
              agentId={currentId}
              systemPrompt={formData.system_prompt}
              onSystemPromptChange={updateSystemPrompt}
              onSave={() => saveMut.mutate()}
              isSaving={saveMut.isPending}
            />
          )}
          {activeTab === "conhecimento" && <KnowledgeTab agentId={currentId} />}
          {activeTab === "ferramentas" && <ToolsTab agentId={currentId} />}
          {activeTab === "integracoes" && <IntegrationTab agentId={currentId} />}
          {activeTab === "teste" && <TestTab agentId={currentId} agentData={agentData} />}
          {activeTab === "uso" && <UsageTab agentId={currentId} />}
        </div>
      </div>

      {/* DIALOG API KEY */}
      <Dialog open={isApiKeyOpen} onOpenChange={setIsApiKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave de API</DialogTitle>
            <DialogDescription>Configure a chave da API do {formData.provider} para este agente. Ela será salva criptografada.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {agentData?.api_key_masked && (
              <p className="text-xs text-muted-foreground">Chave atual: <code className="bg-muted px-1 rounded">{agentData.api_key_masked}</code></p>
            )}
            <Label>Nova API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={formData.api_key}
              onChange={e => setFormData({ ...formData, api_key: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApiKeyOpen(false)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CONFIGURAÇÕES */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configurações de Comportamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center justify-between col-span-2">
              <div>
                <Label>Apenas contatos atribuídos</Label>
                <p className="text-xs text-muted-foreground">O agente só responderá conversas onde está assinado.</p>
              </div>
              <Switch checked={formData.answer_only_assigned} onCheckedChange={c => setFormData({ ...formData, answer_only_assigned: c })} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Pausar ao Intervir</Label>
                <p className="text-xs text-muted-foreground">Pausa IA se humano enviar msg.</p>
              </div>
              <Switch checked={formData.pause_on_human} onCheckedChange={c => setFormData({ ...formData, pause_on_human: c })} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Fora do Horário</Label>
                <p className="text-xs text-muted-foreground">Não responder fora do horário.</p>
              </div>
              <Switch checked={formData.disable_outside_hours} onCheckedChange={c => setFormData({ ...formData, disable_outside_hours: c })} />
            </div>

            <div className="space-y-1">
              <Label>Temperatura ({formData.temperature})</Label>
              <Input type="number" min="0" max="2" step="0.1" value={formData.temperature} onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Max Tokens</Label>
              <Input type="number" value={formData.max_tokens} onChange={e => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Tempo de Espera (segundos)</Label>
              <Input type="number" value={formData.wait_time_seconds} onChange={e => setFormData({ ...formData, wait_time_seconds: parseInt(e.target.value) })} />
              <p className="text-[10px] text-muted-foreground mt-1">Atraso antes de responder para parecer mais humano.</p>
            </div>
            <div className="space-y-1">
              <Label>Limite de Mensagens/Interação</Label>
              <Input type="number" value={formData.max_messages_per_interaction} onChange={e => setFormData({ ...formData, max_messages_per_interaction: parseInt(e.target.value) })} />
              <p className="text-[10px] text-muted-foreground mt-1">Máximo de mensagens antes de pausar/transferir.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
