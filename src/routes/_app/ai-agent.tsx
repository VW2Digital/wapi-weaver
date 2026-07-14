import { createFileRoute } from "@tanstack/react-router";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { AiAgentManager } from "@/components/ai-agent/AiAgentManager";

export const Route = createFileRoute("/_app/ai-agent")({
  component: AiAgentRoute,
});

function AiAgentRoute() {
  usePageHeader({ 
    title: "DS Agente", 
    subtitle: "Gerencie seus agentes de Inteligência Artificial, pastas e treinamentos." 
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <AiAgentManager />
    </div>
  );
}
