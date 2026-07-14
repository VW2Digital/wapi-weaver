import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationOptions, getAgentAssignments, saveAgentAssignments } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export function IntegrationTab({ agentId }: { agentId: string | null }) {
  const qc = useQueryClient();
  const getOptsFn = useServerFn(getIntegrationOptions);
  const getAssignsFn = useServerFn(getAgentAssignments);
  const saveAssignsFn = useServerFn(saveAgentAssignments);

  const [whatsappSessionId, setWhatsappSessionId] = useState<string>("none");
  const [funnelStageId, setFunnelStageId] = useState<string>("none");

  const { data: opts, isLoading: loadingOpts } = useQuery({
    queryKey: ["ds-integration-options"],
    queryFn: () => getOptsFn(),
  });

  const { data: currentAssigns, isLoading: loadingAssigns } = useQuery({
    queryKey: ["ds-agent-assignments", agentId],
    queryFn: () => getAssignsFn({ data: { agent_id: agentId! } }),
    enabled: !!agentId,
  });

  useEffect(() => {
    if (currentAssigns) {
      setWhatsappSessionId(currentAssigns.whatsapp_session_id || "none");
      setFunnelStageId(currentAssigns.funnel_stage_id || "none");
    } else {
      setWhatsappSessionId("none");
      setFunnelStageId("none");
    }
  }, [currentAssigns]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await saveAssignsFn({
        data: {
          agent_id: agentId!,
          whatsapp_session_id: whatsappSessionId === "none" ? null : whatsappSessionId,
          funnel_stage_id: funnelStageId === "none" ? null : funnelStageId,
        },
      });
    },
    onSuccess: () => {
      toast.success("Associação salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["ds-agent-assignments", agentId] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao salvar associação.");
    },
  });

  if (!agentId) return <div className="p-12 text-center text-muted-foreground">Salve o agente primeiro para configurar integrações.</div>;

  if (loadingOpts || loadingAssigns) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connections = opts?.connections || [];
  const funnels = opts?.funnels || [];
  const stages = opts?.stages || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Integrações e Atribuições</h3>
          <p className="text-sm text-muted-foreground">Vincule este agente a uma conexão do WhatsApp ou a uma etapa de Funil de CRM.</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <AlertDescription className="text-primary font-medium">
          Ao vincular o agente a uma conexão, ele responderá automaticamente às conversas do WhatsApp dessa sessão.
          Se vinculado a um Funil, ele assumirá o atendimento quando um contato entrar na etapa selecionada.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* WhatsApp Card */}
        <div className="space-y-3 border p-4 rounded-lg bg-background flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-base mb-1">WhatsApp</h4>
            <p className="text-sm text-muted-foreground">O agente responderá a todas as mensagens desta sessão.</p>
            
            <div className="space-y-1.5 mt-6">
              <Label>Conexão WhatsApp</Label>
              <Select value={whatsappSessionId} onValueChange={setWhatsappSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Desativado)</SelectItem>
                  {connections.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || `Sessão (${c.id.substring(0, 8)})`} {c.status ? `(${c.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Funnel Card */}
        <div className="space-y-3 border p-4 rounded-lg bg-background flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-base mb-1">Funil CRM</h4>
            <p className="text-sm text-muted-foreground">O agente atuará automaticamente em etapas específicas.</p>
            
            <div className="space-y-1.5 mt-6">
              <Label>Etapa do Funil</Label>
              <Select value={funnelStageId} onValueChange={setFunnelStageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Desativado)</SelectItem>
                  {funnels.map((f: any) => {
                    const funnelStages = stages.filter((s: any) => s.funnel_id === f.id);
                    if (funnelStages.length === 0) return null;
                    return (
                      <div key={f.id} className="p-1">
                        <div className="text-xs font-semibold px-2 py-1 text-muted-foreground bg-muted/40 rounded-sm">
                          {f.name}
                        </div>
                        {funnelStages.map((s: any) => (
                          <SelectItem key={s.id} value={s.id} className="pl-4">
                            {s.name}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
