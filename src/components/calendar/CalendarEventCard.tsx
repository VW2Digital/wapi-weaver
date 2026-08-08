import React from "react";
import { format } from "date-fns";
import { Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  event_type: string;
  status: string;
  color?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  responsible_user_id?: string | null;
  responsible_name?: string | null;
  team_name?: string | null;
  ds_agent_id?: string | null;
  agent_name?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  created_by_type?: string;
}

interface CalendarEventCardProps {
  event: CalendarEventItem;
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}

export function CalendarEventCard({ event, onClick, compact = false }: CalendarEventCardProps) {
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  const timeDisplay = event.all_day
    ? "Dia Inteiro"
    : `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`;

  const hexColor = event.color || "#7C3AED";
  const isCancelled = event.status === "cancelled";

  // Responsible or Agent owner text
  const ownerText = React.useMemo(() => {
    if (event.created_by_type === "ds_agent" || event.ds_agent_id) {
      return `DS Agent: ${event.agent_name || "Agente"}`;
    }
    if (event.responsible_name) {
      return event.team_name ? `${event.responsible_name} • ${event.team_name}` : event.responsible_name;
    }
    if (event.team_name) {
      return event.team_name;
    }
    return null;
  }, [event]);

  return (
    <div
      onClick={onClick}
      style={{
        borderLeftColor: hexColor,
        backgroundColor: `${hexColor}15`,
      }}
      className={`group relative border-l-4 rounded-md p-1.5 cursor-pointer transition-all hover:shadow-xs hover:opacity-95 text-left overflow-hidden ${
        isCancelled ? "opacity-50 line-through" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold text-xs text-foreground truncate">{event.title}</span>
        {isCancelled && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive text-destructive">
            Cancelado
          </Badge>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{timeDisplay}</div>

      {!compact && ownerText && (
        <div className="flex items-center gap-1 text-[10px] text-foreground/80 mt-1 font-medium truncate">
          {event.ds_agent_id || event.created_by_type === "ds_agent" ? (
            <Bot className="h-3 w-3 text-primary shrink-0" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">{ownerText}</span>
        </div>
      )}
    </div>
  );
}
