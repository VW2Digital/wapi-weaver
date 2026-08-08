import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEventCard, CalendarEventItem } from "./CalendarEventCard";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEventItem[];
  onClickSlot: (date: Date, hour: number) => void;
  onClickEvent: (event: CalendarEventItem) => void;
}

export function DayView({ currentDate, events, onClickSlot, onClickEvent }: DayViewProps) {
  const dayKey = format(currentDate, "yyyy-MM-dd");
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayEvents = events.filter((ev) => {
    const evDay = format(new Date(ev.start_at), "yyyy-MM-dd");
    return evDay === dayKey;
  });

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 7 * 60; // 7 AM @ 60px/hr
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-card rounded-b-xl border-x border-b border-border overflow-hidden">
      {/* Day Header */}
      <div className="py-2.5 px-4 border-b border-border bg-muted/30 text-center font-bold text-sm text-foreground capitalize">
        {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative">
        <div className="flex min-h-[1440px]">
          {/* Y-Axis Hours */}
          <div className="w-20 shrink-0 border-r border-border bg-muted/10 text-muted-foreground text-xs font-mono select-none">
            {hours.map((h) => (
              <div key={h} className="h-[60px] border-b border-border/30 pr-3 pt-1 text-right">
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Slots Column */}
          <div className="flex-1 relative">
            {hours.map((h) => (
              <div
                key={h}
                onClick={() => onClickSlot(currentDate, h)}
                className="h-[60px] border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
              />
            ))}

            {/* Positioned Events */}
            {dayEvents.map((ev) => {
              const startDate = new Date(ev.start_at);
              const endDate = new Date(ev.end_at);

              const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
              const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

              const durationMin = Math.max(25, endMinutes - startMinutes || 30);

              const topPx = startMinutes;
              const heightPx = durationMin;

              return (
                <div
                  key={ev.id}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                  }}
                  className="absolute left-2 right-4 z-10"
                >
                  <CalendarEventCard
                    event={ev}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickEvent(ev);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
