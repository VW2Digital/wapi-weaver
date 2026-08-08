import React from "react";
import { ChevronLeft, ChevronRight, Search, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarHeaderProps {
  currentDate: Date;
  view: "month" | "week" | "day";
  onViewChange: (view: "month" | "week" | "day") => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onToday: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onNavigatePrev,
  onNavigateNext,
  onToday,
  searchQuery,
  onSearchChange,
}: CalendarHeaderProps) {
  // Format header title based on view
  const formattedDateTitle = React.useMemo(() => {
    if (view === "day") {
      return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [currentDate, view]);

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 border-b border-border bg-card/60 backdrop-blur-sm rounded-t-xl">
      {/* Date Navigation & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="font-medium text-xs border-border hover:bg-accent"
        >
          Hoje
        </Button>

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigatePrev}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigateNext}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-base md:text-lg font-display font-semibold text-foreground capitalize ml-1">
          {formattedDateTitle}
        </h2>
      </div>

      {/* Right Controls & Search */}
      <div className="flex items-center gap-3 justify-between md:justify-end">
        <div className="relative w-48 md:w-60">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs bg-background border-border rounded-lg"
          />
        </div>

        {/* View Switcher */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            onClick={() => onViewChange("day")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === "day"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dia
          </button>
          <button
            onClick={() => onViewChange("week")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === "week"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => onViewChange("month")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === "month"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mês
          </button>
        </div>

        {/* Header Action / Back button strictly on RIGHT */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          className="h-8 text-xs border-border gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <span>Voltar</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
