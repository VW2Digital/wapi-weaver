import React, { useState, useRef } from "react";
import {
  Eye,
  EyeOff,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FollowupModal } from "./FollowupModal";

interface FollowupItem {
  id: string;
  name: string;
  message: string;
  type: "manual" | "generativo";
  recurrence: "unico" | "recorrente" | "diario";
  wait_amount: number;
  wait_unit: "minutos" | "horas" | "dias";
}

interface TabTrainingProps {
  agentData: any;
  onChangeField: (field: string, value: any) => void;
  followups: FollowupItem[];
  onAddFollowup: (followup: any) => void;
  onDeleteFollowup: (id: string) => void;
}

export function TabTraining({
  agentData,
  onChangeField,
  followups,
  onAddFollowup,
  onDeleteFollowup,
}: TabTrainingProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isActionAnalyzerOpen, setIsActionAnalyzerOpen] = useState(true);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);

  const mode = agentData.mode || "basico";
  const instructionsText =
    mode === "basico"
      ? agentData.instructions_basic || ""
      : agentData.instructions_advanced || "";

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = instructionsText;
    const newText = currentText.substring(0, start) + variable + currentText.substring(end);

    const targetField = mode === "basico" ? "instructions_basic" : "instructions_advanced";
    onChangeField(targetField, newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 50);
  };

  const variables = [
    { label: "Nome Lead", var: "{{nome_lead}}" },
    { label: "Telefone", var: "{{telefone}}" },
    { label: "E-mail", var: "{{email}}" },
    { label: "Empresa", var: "{{empresa}}" },
    { label: "Etapa CRM", var: "{{etapa}}" },
    { label: "Produto", var: "{{produto}}" },
    { label: "Data Atual", var: "{{data_atual}}" },
    { label: "Link Agenda", var: "{{link_agenda}}" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Fixed Left Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
          <Settings className="h-4 w-4 text-primary" /> Configurações do Agente
        </h3>

        {/* Nome do Agente */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">Nome do Agente</Label>
          <Input
            value={agentData.name || ""}
            onChange={(e) => onChangeField("name", e.target.value)}
            className="bg-background border-border text-foreground focus:border-primary"
          />
        </div>

        {/* Provedor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium">Provedor de Inteligência Artificial</Label>
          <Select
            value={agentData.provider || "Google Gemini"}
            onValueChange={(val) => {
              onChangeField("provider", val);
              if (val === "Google Gemini" && (!agentData.model || agentData.model.startsWith("gpt"))) {
                onChangeField("model", "gemini-2.5-flash");
              } else if (val === "OpenAI Padrão" && (!agentData.model || agentData.model.startsWith("gemini"))) {
                onChangeField("model", "gpt-4o-mini");
              } else if (val === "Anthropic Claude" && (!agentData.model || !agentData.model.startsWith("claude"))) {
                onChangeField("model", "claude-3-5-sonnet");
              }
            }}
          >
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="Google Gemini">Google Gemini (Recomendado)</SelectItem>
              <SelectItem value="OpenAI Padrão">OpenAI Padrão</SelectItem>
              <SelectItem value="Anthropic Claude">Anthropic Claude</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Chave de API mascarada com Olho */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>
              {agentData.provider === "Google Gemini"
                ? "API Key do Google Gemini"
                : agentData.provider === "Anthropic Claude"
                ? "API Key da Anthropic"
                : "API Key da OpenAI"}
            </span>
            <span className="text-[10px] text-muted-foreground">Opcional se global</span>
          </Label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              placeholder={
                agentData.provider === "Google Gemini"
                  ? "AIzaSy... (Chave do Google AI Studio)"
                  : agentData.provider === "Anthropic Claude"
                  ? "sk-ant-... (Chave Anthropic)"
                  : "sk-... (Chave OpenAI)"
              }
              value={agentData.api_key_encrypted || ""}
              onChange={(e) => onChangeField("api_key_encrypted", e.target.value)}
              className="bg-background border-border text-foreground pr-10 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {agentData.provider === "Google Gemini" ? (
              <>👉 Obtenha sua API Key gratuita no <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-primary underline font-medium">Google AI Studio (aistudio.google.com)</a>.</>
            ) : agentData.provider === "Anthropic Claude" ? (
              <>👉 Obtenha sua API Key no <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-primary underline font-medium">Console Anthropic</a>.</>
            ) : (
              <>👉 Obtenha sua API Key na <a href="https://platform.openai.com" target="_blank" rel="noreferrer" className="text-primary underline font-medium">Plataforma OpenAI</a>.</>
            )}
          </p>
        </div>

        {/* Seleção do Modelo baseada no Provedor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>
              {agentData.provider === "Google Gemini"
                ? "Modelo Gemini"
                : agentData.provider === "Anthropic Claude"
                ? "Modelo Claude"
                : "Modelo OpenAI"}
            </span>
            <Settings className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-primary" />
          </Label>
          <Select
            value={
              agentData.model ||
              (agentData.provider === "Google Gemini"
                ? "gemini-2.5-flash"
                : agentData.provider === "Anthropic Claude"
                ? "claude-3-5-sonnet"
                : "gpt-4o-mini")
            }
            onValueChange={(val) => onChangeField("model", val)}
          >
            <SelectTrigger className="bg-background border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              {agentData.provider === "Google Gemini" ? (
                <>
                  <SelectItem value="gemini-2.5-flash">gemini-2.5-flash (Recomendado / Ultra Rápido)</SelectItem>
                  <SelectItem value="gemini-2.0-flash">gemini-2.0-flash (Nova Geração)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">gemini-1.5-pro (Raciocínio Avançado)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">gemini-1.5-flash</SelectItem>
                </>
              ) : agentData.provider === "Anthropic Claude" ? (
                <>
                  <SelectItem value="claude-3-5-sonnet">claude-3-5-sonnet (Recomendado)</SelectItem>
                  <SelectItem value="claude-3-haiku">claude-3-haiku (Rápido)</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini (Recomendado)</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o (Avançado)</SelectItem>
                  <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Toggles de Configurações */}
        <div className="space-y-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground cursor-pointer">
              Responder tickets com responsável
            </Label>
            <Switch
              checked={!!agentData.reply_with_assigned_agent}
              onCheckedChange={(val) => onChangeField("reply_with_assigned_agent", val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground cursor-pointer">
              Dividir respostas em blocos
            </Label>
            <Switch
              checked={!!agentData.split_replies_in_blocks}
              onCheckedChange={(val) => onChangeField("split_replies_in_blocks", val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground cursor-pointer">Processar imagens</Label>
            <Switch
              checked={!!agentData.process_images}
              onCheckedChange={(val) => onChangeField("process_images", val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-foreground cursor-pointer">
              Desabilitar agente fora da plataforma
            </Label>
            <Switch
              checked={!!agentData.disabled_outside_platform}
              onCheckedChange={(val) => onChangeField("disabled_outside_platform", val)}
            />
          </div>
        </div>
      </div>

      {/* Main Area: Instructions, Analyzer, Followups */}
      <div className="flex-1 space-y-6">
        {/* Basic / Advanced Mode Toggle & Header */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Treinamento e Instruções do Agente
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o comportamento, tom de voz e diretrizes principais da IA durante os atendimentos.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => onChangeField("mode", "basico")}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  mode === "basico"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Básico
              </button>
              <button
                type="button"
                onClick={() => onChangeField("mode", "avancado")}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  mode === "avancado"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Avançado
              </button>
            </div>
          </div>

          {/* Variables Bar */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/80">
            <span className="text-xs text-muted-foreground font-medium mr-1">Inserir Variável:</span>
            {variables.map((v) => (
              <button
                key={v.var}
                type="button"
                onClick={() => insertVariable(v.var)}
                className="rounded-md border border-border bg-muted/60 px-2 py-1 text-xs text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Instructions Textarea */}
          <Textarea
            ref={textareaRef}
            rows={12}
            value={instructionsText}
            onChange={(e) =>
              onChangeField(
                mode === "basico" ? "instructions_basic" : "instructions_advanced",
                e.target.value
              )
            }
            placeholder={
              mode === "basico"
                ? "Você é o SDR da empresa Bliv. Seja amigável, educado e use emojis moderados. Seu objetivo é qualificar o lead {{nome_lead}} e agendar uma reunião..."
                : "System Prompt Avançado (JSON / Markdown / System Instructions livres)..."
            }
            className="w-full bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Collapsible Action Analyzer Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div
            onClick={() => setIsActionAnalyzerOpen(!isActionAnalyzerOpen)}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-display font-bold text-foreground">Analisador de Ações</h4>
                <p className="text-xs text-muted-foreground">
                  Sub-agente responsável por identificar e executar ações automaticamente baseado nas mensagens do cliente.
                </p>
              </div>
            </div>
            {isActionAnalyzerOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {isActionAnalyzerOpen && (
            <div className="p-4 pt-0 border-t border-border/60 bg-muted/20 text-xs text-foreground space-y-3">
              <p className="mt-3">
                O Analisador de Ações monitora a intenção da conversa para disparar ferramentas ativas (ex: agendamento no Google Calendar, criação de tag, alteração de etapa no CRM).
              </p>
              <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between text-muted-foreground">
                <span>Status do Analisador: <strong className="text-primary font-semibold">Ativo em Background</strong></span>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-foreground font-medium">Intenção Automática</span>
              </div>
            </div>
          )}
        </div>

        {/* Follow-up Section */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-display font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Follow-up do Agente
              </h4>
              <p className="text-xs text-muted-foreground">
                Configure gatilhos para reengajar clientes automaticamente quando ficarem sem responder.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setIsFollowupModalOpen(true)}
              className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95"
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Follow Up
            </Button>
          </div>

          {followups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nenhum follow-up cadastrado para este agente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {followups.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-border bg-card p-4 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">{f.name}</span>
                      <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded capitalize font-semibold">
                        {f.type}
                      </span>
                    </div>
                    <button
                      onClick={() => onDeleteFollowup(f.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{f.message}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                    <span>Espere {f.wait_amount} {f.wait_unit}</span>
                    <span className="capitalize font-medium">{f.recurrence}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FollowupModal
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        onAddFollowup={onAddFollowup}
      />
    </div>
  );
}
