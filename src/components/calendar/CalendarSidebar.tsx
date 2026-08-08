import React from "react";
import { Plus, Filter, Users, User, Bot, Tag, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MiniCalendar } from "./MiniCalendar";

export interface FilterState {
  myEventsOnly: boolean;
  responsibleUserId: string | null;
  teamId: string | null;
  dsAgentId: string | null;
  eventType: string | null;
  status: string | null;
}

interface CalendarSidebarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onCreateClick: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  auxData: {
    users: Array<{ id: string; display_name: string | null; full_name: string | null }>;
    teams: Array<{ id: string; name: string }>;
    agents: Array<{ id: string; name: string }>;
  };
}

export function CalendarSidebar({
  selectedDate,
  onSelectDate,
  onCreateClick,
  filters,
  onFilterChange,
  auxData,
}: CalendarSidebarProps) {
  const STORAGE_KEY = "bliv_calendar_sidebar_open_sections";

  const [openSections, setOpenSections] = React.useState<{
    agendas: boolean;
    teams: boolean;
    agents: boolean;
    types: boolean;
    status: boolean;
  }>(() => {
    const defaults = { agendas: false, teams: false, agents: false, types: false, status: false };
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Error reading openSections from localStorage:", e);
    }
    return defaults;
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Error saving openSections to localStorage:", e);
      }
      return next;
    });
  };

  const eventTypes = [
    { value: "reuniao", label: "Reunião", color: "#7C3AED" },
    { value: "consulta", label: "Consulta", color: "#2563EB" },
    { value: "retorno", label: "Retorno", color: "#059669" },
    { value: "ligacao", label: "Ligação", color: "#D97706" },
    { value: "tarefa", label: "Tarefa", color: "#4B5563" },
    { value: "followup", label: "Follow-up", color: "#DB2777" },
    { value: "demonstracao", label: "Demonstração", color: "#4F46E5" },
    { value: "outro", label: "Outro", color: "#6B7280" },
  ];

  const statuses = [
    { value: "agendado", label: "Agendado" },
    { value: "confirmado", label: "Confirmado" },
    { value: "concluido", label: "Concluído" },
    { value: "cancelado", label: "Cancelado" },
    { value: "nao_compareceu", label: "Não Compareceu" },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4 p-4 bg-sidebar border-r border-border overflow-y-auto">
      {/* Create Button */}
      <Button
        onClick={onCreateClick}
        className="w-full h-10 font-bold gap-2 shadow-sm bg-primary text-primary-foreground hover:opacity-90 rounded-xl"
      >
        <Plus className="h-4 w-4" />
        <span>Criar Evento</span>
      </Button>

      {/* Mini Calendar */}
      <MiniCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />

      {/* Filters Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 pt-1">
        <span className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-primary" /> Filtros de Agenda
        </span>
        {(filters.myEventsOnly ||
          filters.responsibleUserId ||
          filters.teamId ||
          filters.dsAgentId ||
          filters.eventType ||
          filters.status) && (
          <button
            onClick={() =>
              onFilterChange({
                myEventsOnly: false,
                responsibleUserId: null,
                teamId: null,
                dsAgentId: null,
                eventType: null,
                status: null,
              })
            }
            className="text-[11px] text-primary hover:underline font-medium"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="space-y-3.5 text-xs">
        {/* Minha Agenda Toggle */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/60">
          <Checkbox
            id="filter-my-events"
            checked={filters.myEventsOnly}
            onCheckedChange={(checked) =>
              onFilterChange({ ...filters, myEventsOnly: !!checked, responsibleUserId: null })
            }
          />
          <Label htmlFor="filter-my-events" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-foreground">
            <User className="h-3.5 w-3.5 text-primary" />
            Somente Minha Agenda
          </Label>
        </div>

        {/* Responsible Users Filter */}
        {!filters.myEventsOnly && (
          <div className="space-y-1.5">
            <button
              onClick={() => toggleSection("agendas")}
              className="flex items-center justify-between w-full font-semibold text-foreground text-xs py-1"
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" /> Responsáveis
              </span>
              {openSections.agendas ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {openSections.agendas && (
              <div className="space-y-1 pl-1 max-h-36 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, responsibleUserId: null })}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                    !filters.responsibleUserId
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-foreground hover:bg-accent/60"
                  }`}
                >
                  <span className="truncate">Todos os responsáveis</span>
                </button>
                {auxData.users.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() =>
                      onFilterChange({
                        ...filters,
                        responsibleUserId: filters.responsibleUserId === u.id ? null : u.id,
                      })
                    }
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                      filters.responsibleUserId === u.id
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <span className="truncate">{u.display_name || u.full_name || "Usuário"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teams Filter */}
        <div className="space-y-1.5 border-t border-border/40 pt-2.5">
          <button
            onClick={() => toggleSection("teams")}
            className="flex items-center justify-between w-full font-semibold text-foreground text-xs py-1"
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> Equipes
            </span>
            {openSections.teams ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.teams && (
            <div className="space-y-1 pl-1">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, teamId: null })}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                  !filters.teamId
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-foreground hover:bg-accent/60"
                }`}
              >
                <span className="truncate">Todas as equipes</span>
              </button>
              {auxData.teams.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      teamId: filters.teamId === t.id ? null : t.id,
                    })
                  }
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                    filters.teamId === t.id
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-foreground hover:bg-accent/60"
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DS Agents Filter */}
        <div className="space-y-1.5 border-t border-border/40 pt-2.5">
          <button
            onClick={() => toggleSection("agents")}
            className="flex items-center justify-between w-full font-semibold text-foreground text-xs py-1"
          >
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-primary" /> DS Agents
            </span>
            {openSections.agents ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.agents && (
            <div className="space-y-1 pl-1">
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, dsAgentId: null })}
                className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                  !filters.dsAgentId
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-foreground hover:bg-accent/60"
                }`}
              >
                <span className="truncate">Todos os agentes</span>
              </button>
              {auxData.agents.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      dsAgentId: filters.dsAgentId === a.id ? null : a.id,
                    })
                  }
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                    filters.dsAgentId === a.id
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-foreground hover:bg-accent/60"
                  }`}
                >
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Event Types Filter */}
        <div className="space-y-1.5 border-t border-border/40 pt-2.5">
          <button
            onClick={() => toggleSection("types")}
            className="flex items-center justify-between w-full font-semibold text-foreground text-xs py-1"
          >
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Tipos de Evento
            </span>
            {openSections.types ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.types && (
            <div className="space-y-1 pl-1">
              {eventTypes.map((et) => (
                <button
                  type="button"
                  key={et.value}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      eventType: filters.eventType === et.value ? null : et.value,
                    })
                  }
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                    filters.eventType === et.value
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-foreground hover:bg-accent/60"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <span className="truncate">{et.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="space-y-1.5 border-t border-border/40 pt-2.5">
          <button
            onClick={() => toggleSection("status")}
            className="flex items-center justify-between w-full font-semibold text-foreground text-xs py-1"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /> Status
            </span>
            {openSections.status ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {openSections.status && (
            <div className="space-y-1 pl-1">
              {statuses.map((st) => (
                <button
                  type="button"
                  key={st.value}
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      status: filters.status === st.value ? null : st.value,
                    })
                  }
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                    filters.status === st.value
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "text-foreground hover:bg-accent/60"
                  }`}
                >
                  <span className="truncate">{st.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
