import React, { useState } from "react";
import { Calendar, Database, FileText, Webhook, Tag, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ToolItem {
  id?: string;
  tool_key: string;
  enabled: boolean;
  config?: any;
}

interface AvailabilityItem {
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface TabToolsProps {
  tools: ToolItem[];
  availability: AvailabilityItem[];
  onToggleTool: (toolKey: string, enabled: boolean, config?: any) => void;
  onSaveAvailability: (availability: AvailabilityItem[]) => void;
}

export function TabTools({
  tools,
  availability,
  onToggleTool,
  onSaveAvailability,
}: TabToolsProps) {
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [localAvail, setLocalAvail] = useState<AvailabilityItem[]>(
    availability.length > 0
      ? availability
      : [
          { weekday: 1, start_time: "08:00", end_time: "18:00", active: true },
          { weekday: 2, start_time: "08:00", end_time: "18:00", active: true },
          { weekday: 3, start_time: "08:00", end_time: "18:00", active: true },
          { weekday: 4, start_time: "08:00", end_time: "18:00", active: true },
          { weekday: 5, start_time: "08:00", end_time: "18:00", active: true },
          { weekday: 6, start_time: "08:00", end_time: "12:00", active: false },
          { weekday: 7, start_time: "08:00", end_time: "12:00", active: false },
        ]
  );

  const getToolEnabled = (key: string) => {
    return !!tools.find((t) => t.tool_key === key)?.enabled;
  };

  const weekdaysMap: Record<number, string> = {
    1: "Segunda",
    2: "Terça",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sábado",
    7: "Domingo",
  };

  const handleToggleDay = (weekday: number, active: boolean) => {
    const updated = localAvail.map((item) =>
      item.weekday === weekday ? { ...item, active } : item
    );
    setLocalAvail(updated);
    onSaveAvailability(updated);
  };

  const handleTimeChange = (weekday: number, field: "start_time" | "end_time", value: string) => {
    const updated = localAvail.map((item) =>
      item.weekday === weekday ? { ...item, [field]: value } : item
    );
    setLocalAvail(updated);
    onSaveAvailability(updated);
  };

  const otherTools = [
    {
      key: "consulta_crm",
      name: "Consulta CRM",
      description: "Permite que a IA busque dados, históricos e campos personalizados do lead automaticamente.",
      icon: Database,
    },
    {
      key: "enviar_proposta",
      name: "Enviar Proposta",
      description: "Permite gerar e enviar propostas comerciais por e-mail ou WhatsApp em PDF.",
      icon: FileText,
    },
    {
      key: "webhook_customizado",
      name: "Webhook Customizado",
      description: "Dispara requisições HTTP para sistemas externos quando o agente identificar uma ação.",
      icon: Webhook,
    },
    {
      key: "gerenciar_tags",
      name: "Gerenciar Tags",
      description: "Adiciona ou remove tags do contato no CRM durante a qualificação automática.",
      icon: Tag,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Ferramentas e Integrações do Agente</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure integrações para que a IA execute ações automaticamente durante as conversas.
        </p>
      </div>

      {/* Google Calendar Primary Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-display font-bold text-foreground">Google Calendar</h4>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                A IA agenda reuniões automaticamente no Google Calendar verificando conflitos de horário.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Switch
              checked={getToolEnabled("google_calendar")}
              onCheckedChange={(val) => onToggleTool("google_calendar", val)}
            />
            <button
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {isCalendarExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {isCalendarExpanded && (
          <div className="p-6 bg-muted/20 space-y-6">
            {/* Account Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg border border-border bg-card">
              <div>
                <span className="text-[11px] text-muted-foreground block">Conta Google</span>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                  comercial@empresa.com
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Calendário Padrão</span>
                <Select defaultValue="principal">
                  <SelectTrigger className="h-8 bg-background border-border text-xs text-foreground mt-1">
                    <SelectValue placeholder="Calendário" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                    <SelectItem value="principal">Agenda Principal</SelectItem>
                    <SelectItem value="reunioes">Demonstrações SDR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Duração Padrão</span>
                <Select defaultValue="30">
                  <SelectTrigger className="h-8 bg-background border-border text-xs text-foreground mt-1">
                    <SelectValue placeholder="Duração" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Fuso Horário</span>
                <Select defaultValue="sp">
                  <SelectTrigger className="h-8 bg-background border-border text-xs text-foreground mt-1">
                    <SelectValue placeholder="Fuso" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                    <SelectItem value="sp">GMT-3 Brasília (America/Sao_Paulo)</SelectItem>
                    <SelectItem value="manaus">GMT-4 Manaus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Disponibilidade Semanal */}
            <div>
              <h5 className="text-sm font-display font-bold text-foreground mb-3">Disponibilidade do Agente para Agendamentos</h5>
              <div className="space-y-2">
                {localAvail.map((item) => (
                  <div
                    key={item.weekday}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={item.active}
                        onCheckedChange={(val) => handleToggleDay(item.weekday, val)}
                      />
                      <span className={`text-xs font-semibold w-24 ${item.active ? "text-foreground" : "text-muted-foreground"}`}>
                        {weekdaysMap[item.weekday]}
                      </span>
                    </div>

                    {item.active ? (
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <span>Das</span>
                        <input
                          type="time"
                          value={item.start_time.slice(0, 5)}
                          onChange={(e) => handleTimeChange(item.weekday, "start_time", `${e.target.value}:00`)}
                          className="bg-background border border-border rounded px-2 py-1 text-foreground focus:border-primary"
                        />
                        <span>até</span>
                        <input
                          type="time"
                          value={item.end_time.slice(0, 5)}
                          onChange={(e) => handleTimeChange(item.weekday, "end_time", `${e.target.value}:00`)}
                          className="bg-background border border-border rounded px-2 py-1 text-foreground focus:border-primary"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Indisponível neste dia</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherTools.map((t) => {
          const Icon = t.icon;
          const isEnabled = getToolEnabled(t.key);
          return (
            <div
              key={t.key}
              className={`rounded-xl border p-5 transition-all ${
                isEnabled
                  ? "border-primary/40 bg-card shadow-sm"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2.5 ${
                      isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-display font-bold text-foreground">{t.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </div>
                </div>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={(val) => onToggleTool(t.key, val)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
