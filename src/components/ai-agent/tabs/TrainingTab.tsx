import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface TrainingTabProps {
  agentId: string | null;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

const VARIABLES = [
  { code: "{{contact.name}}", desc: "Nome do contato" },
  { code: "{{contact.phone}}", desc: "Telefone do contato" },
  { code: "{{company.name}}", desc: "Nome da empresa" },
  { code: "{{datetime}}", desc: "Data e hora atual" },
  { code: "{{date}}", desc: "Data atual" },
  { code: "{{time}}", desc: "Hora atual" },
  { code: "{{agent.name}}", desc: "Nome do agente" },
];

export function TrainingTab({ agentId, systemPrompt, onSystemPromptChange, onSave, isSaving }: TrainingTabProps) {
  return (
    <div className="flex h-full">
      {/* Editor Principal */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Instruções do Sistema (System Prompt)</h3>
            <p className="text-sm text-muted-foreground">
              {agentId
                ? "Defina o comportamento, personalidade e regras do agente. Clique em Salvar para persistir."
                : "Você pode escrever as instruções agora. Elas serão salvas ao clicar em 'Criar Agente'."}
            </p>
          </div>
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
        <Textarea
          className="min-h-[450px] font-mono text-sm resize-y flex-1"
          placeholder={"Você é um assistente especializado em atendimento ao cliente da empresa {{company.name}}.\n\nSuas responsabilidades são:\n- Responder dúvidas sobre produtos e serviços\n- Encaminhar para um humano caso não consiga ajudar\n\nSempre seja cordial e use o nome do contato: {{contact.name}}."}
          value={systemPrompt}
          onChange={e => onSystemPromptChange(e.target.value)}
        />
      </div>

      {/* Sidebar de Variáveis */}
      <div className="w-64 border-l bg-muted/20 p-4 overflow-y-auto hidden md:block shrink-0">
        <h4 className="font-semibold text-sm mb-1">Variáveis Disponíveis</h4>
        <p className="text-[10px] text-muted-foreground mb-4">Clique para copiar</p>
        <div className="space-y-2 text-xs">
          {VARIABLES.map(v => (
            <button
              key={v.code}
              type="button"
              className="w-full text-left p-2 border rounded bg-background hover:bg-muted/50 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(v.code).catch(() => {});
                onSystemPromptChange(systemPrompt + v.code);
              }}
            >
              <code className="text-primary">{v.code}</code>
              <span className="block text-muted-foreground mt-0.5">{v.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
