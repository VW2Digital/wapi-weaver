import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { toast } from "sonner";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarSidebar, FilterState } from "./CalendarSidebar";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { CalendarEventModal } from "./CalendarEventModal";
import { CalendarEventDetailsModal } from "./CalendarEventDetailsModal";
import { CalendarEventItem } from "./CalendarEventCard";
import {
  listCalendarEvents,
  listCalendarAuxData,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/calendar.functions";

export function CalendarPage() {
  const qc = useQueryClient();

  const STORAGE_KEY_FILTERS = "bliv_calendar_filters";
  const STORAGE_KEY_VIEW = "bliv_calendar_view";

  const [view, setView] = React.useState<"month" | "week" | "day">(() => {
    if (typeof window === "undefined") return "month";
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW);
      if (saved === "month" || saved === "week" || saved === "day") return saved;
    } catch {}
    return "month";
  });

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const [filters, setFiltersState] = React.useState<FilterState>(() => {
    const defaultFilters: FilterState = {
      myEventsOnly: false,
      responsibleUserId: null,
      teamId: null,
      dsAgentId: null,
      eventType: null,
      status: null,
    };
    if (typeof window === "undefined") return defaultFilters;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILTERS);
      if (saved) return { ...defaultFilters, ...JSON.parse(saved) };
    } catch {}
    return defaultFilters;
  });

  const setFilters = (newFilters: FilterState) => {
    setFiltersState(newFilters);
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(newFilters));
    } catch (e) {
      console.error("Error saving filters to localStorage:", e);
    }
  };

  const handleViewChange = (newView: "month" | "week" | "day") => {
    setView(newView);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW, JSON.stringify(newView));
    } catch (e) {
      console.error("Error saving view to localStorage:", e);
    }
  };

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState<{ start: Date; end: Date } | null>(null);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventItem | null>(null);

  // Server functions
  const fetchEvents = useServerFn(listCalendarEvents);
  const fetchAux = useServerFn(listCalendarAuxData);
  const createEv = useServerFn(createCalendarEvent);
  const updateEv = useServerFn(updateCalendarEvent);
  const cancelEv = useServerFn(cancelCalendarEvent);
  const deleteEv = useServerFn(deleteCalendarEvent);

  // Aux Data Query
  const { data: auxData = { contacts: [], users: [], teams: [], agents: [] } } = useQuery({
    queryKey: ["calendar-aux-data"],
    queryFn: () => fetchAux(),
    staleTime: 60_000,
  });

  // Range calculation for Query
  const { rangeStart, rangeEnd } = React.useMemo(() => {
    let start: Date;
    let end: Date;

    if (view === "month") {
      start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    } else if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else {
      start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
    }

    return {
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    };
  }, [currentDate, view]);

  // Events Query
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events", rangeStart, rangeEnd, filters, searchQuery],
    queryFn: async () => {
      const res = await fetchEvents({
        data: {
          startDateUtc: rangeStart,
          endDateUtc: rangeEnd,
          responsible_user_id: filters.responsibleUserId,
          responsibleUserId: filters.responsibleUserId,
          team_id: filters.teamId,
          teamId: filters.teamId,
          ds_agent_id: filters.dsAgentId,
          dsAgentId: filters.dsAgentId,
          event_type: filters.eventType,
          eventType: filters.eventType,
          status: filters.status,
          my_events_only: filters.myEventsOnly,
          myEventsOnly: filters.myEventsOnly,
          search: searchQuery || null,
          filters: {
            responsible_user_id: filters.responsibleUserId,
            responsibleUserId: filters.responsibleUserId,
            team_id: filters.teamId,
            teamId: filters.teamId,
            ds_agent_id: filters.dsAgentId,
            dsAgentId: filters.dsAgentId,
            event_type: filters.eventType,
            eventType: filters.eventType,
            status: filters.status,
            my_events_only: filters.myEventsOnly,
            myEventsOnly: filters.myEventsOnly,
            search: searchQuery || null,
          },
        },
      });
      return (res?.events as CalendarEventItem[]) || [];
    },
    refetchInterval: 15_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (input: any) => createEv({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Evento criado com sucesso!");
      if (res.conflictWarning) {
        toast.warning(res.conflictWarning);
      }
      setIsCreateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar evento");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateEv({
        data: {
          id,
          eventId: id,
          ...data,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Evento atualizado com sucesso!");
      if (res.conflictWarning) {
        toast.warning(res.conflictWarning);
      }
      setIsCreateOpen(false);
      setIsDetailsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar evento");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelEv({ data: { eventId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Evento cancelado");
      setIsDetailsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cancelar evento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEv({ data: { eventId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Evento excluído");
      setIsDetailsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir evento");
    },
  });

  // Navigation handlers
  const handleToday = () => setCurrentDate(new Date());

  const handlePrev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const handleNext = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const handleSlotSelect = (start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setSelectedEvent(null);
    setIsCreateOpen(true);
  };

  const handleEventSelect = (event: CalendarEventItem) => {
    setSelectedEvent(event);
    setIsDetailsOpen(true);
  };

  const handleOpenDayView = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  return (
    <div className="p-2 md:p-3 h-[calc(100vh-2rem)] flex flex-col">
      {/* Outer Single Unified Container */}
      <div className="flex-1 flex flex-col md:flex-row rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-0">
        {/* Left Sidebar */}
        <CalendarSidebar
          selectedDate={currentDate}
          onSelectDate={(d) => {
            setCurrentDate(d);
            if (view === "month") handleViewChange("day");
          }}
          onCreateClick={() => {
            const start = new Date(currentDate);
            start.setHours(9, 0, 0, 0);
            const end = new Date(currentDate);
            end.setHours(10, 0, 0, 0);
            handleSlotSelect(start, end);
          }}
          filters={filters}
          onFilterChange={setFilters}
          auxData={auxData}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Header */}
          <CalendarHeader
            currentDate={currentDate}
            view={view}
            onViewChange={handleViewChange}
            onNavigatePrev={handlePrev}
            onNavigateNext={handleNext}
            onToday={handleToday}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* Active View */}
          <main className="flex-1 overflow-hidden relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-xs z-20 flex items-center justify-center">
                <div className="text-xs font-semibold text-muted-foreground animate-pulse">
                  Carregando agenda...
                </div>
              </div>
            )}

            {view === "month" && (
              <MonthView
                currentDate={currentDate}
                events={events}
                onSelectSlot={handleSlotSelect}
                onSelectEvent={handleEventSelect}
                onOpenDayView={handleOpenDayView}
              />
            )}

            {view === "week" && (
              <WeekView
                currentDate={currentDate}
                events={events}
                onSelectSlot={handleSlotSelect}
                onSelectEvent={handleEventSelect}
                onOpenDayView={handleOpenDayView}
              />
            )}

            {view === "day" && (
              <DayView
                currentDate={currentDate}
                events={events}
                onSelectSlot={handleSlotSelect}
                onSelectEvent={handleEventSelect}
              />
            )}
          </main>
        </div>
      </div>

      {/* Event Create / Edit Modal */}
      {isCreateOpen && (
        <CalendarEventModal
          isOpen={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false);
            setSelectedEvent(null);
            setSelectedSlot(null);
          }}
          initialSlot={selectedSlot}
          eventToEdit={selectedEvent}
          auxData={auxData}
          onSubmit={async (data) => {
            if (selectedEvent) {
              updateMutation.mutate({ id: selectedEvent.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Event Details Modal */}
      {isDetailsOpen && selectedEvent && (
        <CalendarEventDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onEdit={() => {
            setIsDetailsOpen(false);
            setIsCreateOpen(true);
          }}
          onCancel={() => cancelMutation.mutate(selectedEvent.id)}
          onDelete={() => deleteMutation.mutate(selectedEvent.id)}
          isActionPending={cancelMutation.isPending || deleteMutation.isPending}
        />
      )}
    </div>
  );
}
