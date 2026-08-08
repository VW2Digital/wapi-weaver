import React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const [viewDate, setViewDate] = React.useState<Date>(selectedDate);

  React.useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  const formattedMonthTitle = React.useMemo(() => {
    const raw = format(viewDate, "MMMM yyyy", { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewDate]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2">
      {/* Header Month / Nav */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-display text-foreground">
          {formattedMonthTitle}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center pb-1 border-b border-border/40">
        {weekDays.map((day, idx) => (
          <span key={idx} className="text-[10px] font-bold text-muted-foreground">
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((dayDate) => {
          const isSelected = isSameDay(dayDate, selectedDate);
          const isCurrentMonth = isSameMonth(dayDate, viewDate);
          const isCurrentDay = isToday(dayDate);

          return (
            <button
              key={dayDate.toISOString()}
              onClick={() => onSelectDate(dayDate)}
              className={`h-7 w-full rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                  : isCurrentDay
                  ? "bg-primary/20 text-primary font-bold border border-primary/40"
                  : isCurrentMonth
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/40 hover:bg-muted/40"
              }`}
            >
              {format(dayDate, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
