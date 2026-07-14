import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgentUsageStats } from "@/lib/ds-agent.functions";
import { Loader2, ShieldAlert, BarChart3 } from "lucide-react";

export function UsageTab({ agentId }: { agentId: string | null }) {
  const getStatsFn = useServerFn(getAgentUsageStats);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["ds-agent-usage", agentId],
    queryFn: () => getStatsFn({ data: { agent_id: agentId! } }),
    enabled: !!agentId,
  });

  if (!agentId) return <div className="p-12 text-center text-muted-foreground">Salve o agente primeiro.</div>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const logs = stats?.logs || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Métricas de Uso e Logs</h3>
        <p className="text-sm text-muted-foreground">Visualize o consumo de tokens e o log de atividades deste agente em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-5 bg-background shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Total de Chamadas (Mensagens)</p>
          <p className="text-3xl font-bold mt-2 text-primary">{stats?.total_calls}</p>
        </div>
        <div className="border rounded-lg p-5 bg-background shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Tokens Utilizados (Acumulado)</p>
          <p className="text-3xl font-bold mt-2 text-primary">{stats?.total_tokens}</p>
          <p className="text-xs text-muted-foreground mt-1">Prompt: {stats?.prompt_tokens} | Comp: {stats?.completion_tokens}</p>
        </div>
        <div className="border rounded-lg p-5 bg-background shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Tempo Médio de Resposta</p>
          <p className="text-3xl font-bold mt-2 text-primary">{stats?.avg_response_time}ms</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Logs de Atividades Recentes</h4>
        </div>
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <BarChart3 className="h-8 w-8 opacity-25" />
              Nenhum evento registrado ainda para este agente.
            </div>
          ) : (
            logs.map((log: any, i: number) => {
              const isError = log.level === "error";
              const isWarn = log.level === "warn";
              return (
                <div key={i} className="px-4 py-2.5 flex items-start justify-between text-xs gap-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm font-semibold text-[9px] uppercase shrink-0 ${
                        isError
                          ? "bg-destructive/10 text-destructive"
                          : isWarn
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-foreground leading-relaxed break-all">{log.message}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
