import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-2 shadow-xs">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(d) => d && onSelectDate(d)}
        locale={ptBR}
        className="w-full font-sans"
        classNames={{
          months: "w-full",
          month: "w-full space-y-2",
          month_caption: "flex justify-center pt-1 relative items-center text-xs font-semibold text-foreground capitalize",
          nav: "space-x-1 flex items-center justify-between w-full absolute top-1 px-1",
          button_previous: "h-6 w-6 bg-transparent p-0 opacity-70 hover:opacity-100 border border-border rounded-md",
          button_next: "h-6 w-6 bg-transparent p-0 opacity-70 hover:opacity-100 border border-border rounded-md",
          month_grid: "w-full border-collapse space-y-1",
          weekdays: "flex justify-between border-b border-border/40 pb-1 mb-1",
          weekday: "text-muted-foreground rounded-md w-7 font-normal text-[10px] text-center capitalize",
          week: "flex w-full mt-1 justify-between",
          day: "h-7 w-7 text-center text-xs p-0 relative rounded-lg focus-within:relative focus-within:z-20",
          today: "bg-muted text-primary font-bold border border-primary/30",
          outside: "text-muted-foreground/40 opacity-40",
          disabled: "text-muted-foreground/30 opacity-30",
          hidden: "invisible",
        }}
      />
    </div>
  );
}
