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
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEventCard, CalendarEventItem } from "./CalendarEventCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRight, CalendarDays } from "lucide-react";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
  onOpenDayView: (date: Date) => void;
}

export function MonthView({
  currentDate,
  events,
  onSelectSlot,
  onSelectEvent,
  onOpenDayView,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const weekCount = Math.ceil(days.length / 7);

  const getEventsForDay = (dayDate: Date) => {
    return events.filter((ev) => {
      const evStart = new Date(ev.start_at);
      return isSameDay(evStart, dayDate);
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 shrink-0">
        {weekDays.map((day, idx) => (
          <div
            key={idx}
            className="py-2 text-center text-[11px] font-bold font-display tracking-wider text-muted-foreground border-r border-border/40 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        className="grid grid-cols-7 flex-1 h-full min-h-0 divide-x divide-y divide-border/60 overflow-hidden"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {days.map((dayDate) => {
          const isCurrentMonth = isSameMonth(dayDate, currentDate);
          const isCurrentDay = isToday(dayDate);
          const dayEvents = getEventsForDay(dayDate);
          const maxVisible = 2;
          const visibleEvents = dayEvents.slice(0, maxVisible);
          const hiddenCount = dayEvents.length - maxVisible;

          return (
            <div
              key={dayDate.toISOString()}
              onDoubleClick={() => onOpenDayView(dayDate)}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  const start = new Date(dayDate);
                  start.setHours(9, 0, 0, 0);
                  const end = new Date(dayDate);
                  end.setHours(10, 0, 0, 0);
                  onSelectSlot(start, end);
                }
              }}
              title="Clique duplo para abrir a visão diária deste dia"
              className={`h-full min-h-0 p-1.5 flex flex-col justify-start gap-1 transition-colors cursor-pointer overflow-hidden group/cell ${
                isCurrentMonth ? "bg-card/40 hover:bg-accent/30" : "bg-muted/20 text-muted-foreground/40"
              }`}
            >
              {/* Day Number Header - Clickable to open Day View */}
              <div className="flex items-center justify-between mb-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDayView(dayDate);
                  }}
                  className="flex items-center gap-1 group/btn text-left"
                  title="Ver agenda deste dia"
                >
                  <span
                    className={`text-xs font-semibold h-5.5 w-5.5 rounded-full flex items-center justify-center transition-all ${
                      isCurrentDay
                        ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                        : isCurrentMonth
                        ? "text-foreground group-hover/btn:bg-primary/20 group-hover/btn:text-primary"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {format(dayDate, "d")}
                  </span>
                </button>

                {dayEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDayView(dayDate);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-primary font-medium pr-1 flex items-center gap-0.5"
                  >
                    <span>{dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}</span>
                  </button>
                )}
              </div>

              {/* Event Cards */}
              <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0 pr-0.5">
                {visibleEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(ev);
                    }}
                  >
                    <CalendarEventCard event={ev} compact />
                  </div>
                ))}

                {hiddenCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-semibold text-primary hover:underline text-left px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors shrink-0 flex items-center justify-between"
                      >
                        <span>+{hiddenCount} mais...</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2.5 space-y-2 z-50 bg-card border-border shadow-md rounded-xl">
                      <div className="text-xs font-bold text-foreground pb-1.5 border-b border-border flex items-center justify-between">
                        <span>{format(dayDate, "d 'de' MMMM", { locale: ptBR })}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">{dayEvents.length} eventos</span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => onSelectEvent(ev)}
                            className="cursor-pointer"
                          >
                            <CalendarEventCard event={ev} compact />
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDayView(dayDate)}
                        className="w-full pt-1.5 border-t border-border/60 text-[11px] font-semibold text-primary hover:underline flex items-center justify-center gap-1"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>Ver dia completo</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
