import React from "react";
import { ChevronLeft, ChevronRight, Search, ArrowRight } from "lucide-react";
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
  // Format header title without CSS capitalize to avoid "Agosto De 2026"
  const formattedDateTitle = React.useMemo(() => {
    if (view === "day") {
      const raw = format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    const raw = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [currentDate, view]);

  return (
    <header className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
      {/* Date Navigation & Title */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="font-semibold text-xs border-border hover:bg-accent h-8 rounded-lg"
        >
          Hoje
        </Button>

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
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

        <h2 className="text-base lg:text-lg font-display font-bold text-foreground ml-1">
          {formattedDateTitle}
        </h2>
      </div>

      {/* Right Actions, Search & View Selector */}
      <div className="flex items-center gap-3 justify-between lg:justify-end">
        {/* Search */}
        <div className="relative w-40 sm:w-56">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs bg-background border-border rounded-lg"
          />
        </div>

        {/* View Switcher Segmented Control */}
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => onViewChange("day")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              view === "day"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dia
          </button>
          <button
            onClick={() => onViewChange("week")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              view === "week"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => onViewChange("month")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              view === "month"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mês
          </button>
        </div>

        {/* Back Button strictly on the RIGHT */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.history.back()}
          className="h-8 text-xs border-border gap-1.5 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <span>Voltar</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
