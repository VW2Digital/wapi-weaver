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
import { getProfile } from "@/lib/profile.functions";
import { toast } from "sonner";
import { BotFlowCanvas } from "@/components/bot-flow/BotFlowCanvas";
import { StepInspector } from "@/components/bot-flow/StepInspector";
import { BOT_TEMPLATES, mapTemplateSteps } from "@/lib/bot-templates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";
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
  const getProfileFn = useServerFn(getProfile);

  const [steps, setSteps] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
  });

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

  const isSettingsActive = (settingsQuery.data as any)?.settings?.is_active || (settingsQuery.data as any)?.is_active || false;

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

          <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="secondary">
                <BookOpen className="w-4 h-4 mr-2" />
                Galeria de Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Galeria de Fluxos de Bot</DialogTitle>
                <DialogDescription>
                  Selecione um template pronto para carregar no Canvas. 
                  <br/><strong className="text-destructive">Atenção:</strong> Carregar um template irá APAGAR o fluxo atual não salvo da tela.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {BOT_TEMPLATES.map((template) => (
                  <Card 
                    key={template.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => {
                      try {
                        const newSteps = mapTemplateSteps(template.steps);
                        setSteps(newSteps);
                        setSelectedStep(null);
                        setIsGalleryOpen(false);
                        toast.success(`Template "${template.name}" carregado! Não se esqueça de Salvar.`);
                      } catch (e) {
                        toast.error("Erro ao carregar template.");
                        console.error(e);
                      }
                    }}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">{template.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <div className="text-xs text-muted-foreground mt-4">
            Dica: Clique em um bloco no painel ao lado para editar suas configurações.
          </div>
        </div>

        {/* CANVAS */}
        <div className="flex-1 relative">
          <BotFlowCanvas 
            key={steps.length > 0 ? steps[0].id : 'empty'} 
            steps={steps} 
            onStepsChange={setSteps} 
            onNodeClick={setSelectedStep} 
          />
        </div>

        {/* INSPECTOR */}
        {selectedStep && (
          <StepInspector
            selectedStep={selectedStep}
            handleUpdateStep={handleUpdateStep}
            handleDeleteStep={handleDeleteStep}
            steps={steps}
            agentName={profileQuery.data?.display_name || profileQuery.data?.full_name || "Atendente"}
          />
        )}
      </div>
    </div>
  );
}
