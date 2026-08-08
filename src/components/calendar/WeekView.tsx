import React from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEventCard, CalendarEventItem } from "./CalendarEventCard";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectSlot: (start: Date, end: Date) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
  onOpenDayView?: (date: Date) => void;
}

export function WeekView({
  currentDate,
  events,
  onSelectSlot,
  onSelectEvent,
  onOpenDayView,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to 07:00 AM on mount
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 7 * 60; // 7 AM @ 60px/hr
    }
  }, []);

  const handleSlotClick = (dayDate: Date, hour: number) => {
    const start = new Date(dayDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(dayDate);
    end.setHours(hour + 1, 0, 0, 0);
    onSelectSlot(start, end);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Week Header Days */}
      <div className="flex border-b border-border bg-muted/40 pl-16 shrink-0">
        {weekDays.map((dayDate) => {
          const isCurrentDay = isToday(dayDate);
          return (
            <button
              type="button"
              key={dayDate.toISOString()}
              onClick={() => onOpenDayView?.(dayDate)}
              title="Clique para ver a agenda deste dia"
              className="flex-1 py-2 text-center border-l border-border/50 text-xs hover:bg-accent/40 transition-colors group cursor-pointer"
            >
              <div className="text-muted-foreground group-hover:text-primary uppercase text-[11px] font-bold">
                {format(dayDate, "eee", { locale: ptBR })}
              </div>
              <div
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isCurrentDay ? "bg-primary text-primary-foreground font-bold shadow-xs" : "text-foreground group-hover:text-primary"
                }`}
              >
                {format(dayDate, "d MMM", { locale: ptBR })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hourly Grid Body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        <div className="flex min-h-[1440px]">
          {/* Hours Column Y-Axis */}
          <div className="w-16 shrink-0 border-r border-border bg-muted/10 text-muted-foreground text-[11px] font-mono select-none">
            {hours.map((h) => (
              <div key={h} className="h-[60px] border-b border-border/30 pr-2 pt-1 text-right">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 Day Columns */}
          <div className="flex-1 flex relative">
            {weekDays.map((dayDate) => {
              const dayKey = format(dayDate, "yyyy-MM-dd");

              // Events belonging to this day
              const dayEvents = events.filter((ev) => {
                const evDay = format(new Date(ev.start_at), "yyyy-MM-dd");
                return evDay === dayKey;
              });

              return (
                <div key={dayKey} className="flex-1 border-l border-border/40 relative">
                  {/* Hour slots */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      onClick={() => handleSlotClick(dayDate, h)}
                      className="h-[60px] border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                    />
                  ))}

                  {/* Render Day Events positioning by time */}
                  {dayEvents.map((ev) => {
                    const startDate = new Date(ev.start_at);
                    const endDate = new Date(ev.end_at);

                    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
                    const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

                    const durationMin = Math.max(25, endMinutes - startMinutes || 30);

                    const topPx = startMinutes; // 1 min = 1 px
                    const heightPx = durationMin;

                    return (
                      <div
                        key={ev.id}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                        }}
                        className="absolute left-1 right-1 z-10"
                      >
                        <CalendarEventCard
                          event={ev}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(ev);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
