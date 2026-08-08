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
import { Button } from "@/components/ui/button";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onClickDay: (date: Date) => void;
  onClickEvent: (event: CalendarEventItem) => void;
}

export function MonthView({ currentDate, events, onClickDay, onClickEvent }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDaysHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Group events by day
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    events.forEach((ev) => {
      const dayKey = format(new Date(ev.start_at), "yyyy-MM-dd");
      const list = map.get(dayKey) || [];
      list.push(ev);
      map.set(dayKey, list);
    });
    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-card rounded-b-xl border-x border-b border-border overflow-hidden">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-semibold py-2">
        {weekDaysHeaders.map((dayName) => (
          <div key={dayName} className="text-muted-foreground uppercase text-[11px] font-bold">
            {dayName}
          </div>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 grid-rows-5 flex-1 divide-x divide-y divide-border/60 min-h-[550px]">
        {days.map((dayDate) => {
          const dayKey = format(dayDate, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(dayKey) || [];
          const isCurrentMonth = isSameMonth(dayDate, currentDate);
          const isCurrentDay = isToday(dayDate);

          const maxVisible = 3;
          const visibleEvents = dayEvents.slice(0, maxVisible);
          const extraCount = dayEvents.length - maxVisible;

          return (
            <div
              key={dayKey}
              onClick={(e) => {
                // If clicked on day background
                if (e.target === e.currentTarget) {
                  onClickDay(dayDate);
                }
              }}
              className={`p-1.5 flex flex-col justify-start transition-colors min-h-[90px] ${
                !isCurrentMonth ? "bg-muted/15 text-muted-foreground/50" : "bg-card hover:bg-muted/20"
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1 pointer-events-none">
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {format(dayDate, "d")}
                </span>
              </div>

              {/* Event chips */}
              <div className="space-y-1 flex-1 overflow-y-auto">
                {visibleEvents.map((ev) => (
                  <CalendarEventCard
                    key={ev.id}
                    event={ev}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickEvent(ev);
                    }}
                    compact
                  />
                ))}

                {extraCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-semibold text-primary hover:underline px-1 py-0.5 block w-full text-left"
                      >
                        +{extraCount} eventos
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 space-y-1 bg-popover border-border" align="start">
                      <div className="text-xs font-bold text-foreground border-b border-border pb-1 mb-1">
                        {format(dayDate, "d 'de' MMMM", { locale: ptBR })}
                      </div>
                      {dayEvents.map((ev) => (
                        <CalendarEventCard
                          key={ev.id}
                          event={ev}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClickEvent(ev);
                          }}
                        />
                      ))}
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
