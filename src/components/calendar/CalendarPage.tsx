import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
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
  const queryClient = useQueryClient();

  const fetchEvents = useServerFn(listCalendarEvents);
  const fetchAuxData = useServerFn(listCalendarAuxData);
  const createFn = useServerFn(createCalendarEvent);
  const updateFn = useServerFn(updateCalendarEvent);
  const cancelFn = useServerFn(cancelCalendarEvent);
  const deleteFn = useServerFn(deleteCalendarEvent);

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<"month" | "week" | "day">("month");
  const [searchQuery, setSearchQuery] = React.useState("");

  const [filters, setFilters] = React.useState<FilterState>({
    myEventsOnly: false,
    responsibleUserId: null,
    teamId: null,
    dsAgentId: null,
    eventType: null,
    status: null,
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [eventToEdit, setEventToEdit] = React.useState<CalendarEventItem | null>(null);

  const [initialDateForCreate, setInitialDateForCreate] = React.useState<Date | undefined>();
  const [initialStartTimeForCreate, setInitialStartTimeForCreate] = React.useState<string | undefined>();
  const [initialEndTimeForCreate, setInitialEndTimeForCreate] = React.useState<string | undefined>();

  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEventItem | null>(null);

  // Aux data query
  const auxQuery = useQuery({
    queryKey: ["calendar-aux-data"],
    queryFn: () => fetchAuxData(),
    staleTime: 60000,
  });

  const auxData = React.useMemo(() => {
    return {
      contacts: auxQuery.data?.contacts || [],
      users: auxQuery.data?.users || [],
      teams: auxQuery.data?.teams || [],
      agents: auxQuery.data?.agents || [],
    };
  }, [auxQuery.data]);

  // Calculate range string in UTC
  const range = React.useMemo(() => {
    let start: Date;
    let end: Date;

    if (view === "month") {
      start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    } else if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else {
      start = currentDate;
      end = currentDate;
    }

    const startDateStr = format(start, "yyyy-MM-dd") + " 00:00:00";
    const endDateStr = format(end, "yyyy-MM-dd") + " 23:59:59";

    return { startDateStr, endDateStr };
  }, [currentDate, view]);

  // Events Query
  const eventsQuery = useQuery({
    queryKey: [
      "calendar-events",
      range.startDateStr,
      range.endDateStr,
      filters,
      searchQuery,
    ],
    queryFn: () =>
      fetchEvents({
        data: {
          startDate: range.startDateStr,
          endDate: range.endDateStr,
          responsible_user_id: filters.responsibleUserId,
          team_id: filters.teamId,
          ds_agent_id: filters.dsAgentId,
          event_type: filters.eventType,
          status: filters.status,
          search: searchQuery,
          my_events_only: filters.myEventsOnly,
        },
      }),
    refetchInterval: 15000,
  });

  const eventsList: CalendarEventItem[] = eventsQuery.data?.events || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: (res) => {
      if (res.conflictWarning) {
        toast.warning(res.conflictWarning);
      } else {
        toast.success("Evento agendado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar evento");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateFn({ data }),
    onSuccess: (res) => {
      if (res.conflictWarning) {
        toast.warning(res.conflictWarning);
      } else {
        toast.success("Evento atualizado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar evento");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Evento cancelado");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cancelar evento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Evento excluído da agenda");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir evento");
    },
  });

  // Navigation handlers
  const handleNavigatePrev = () => {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const handleNavigateNext = () => {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Slot & Day clicks
  const handleClickDay = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleClickSlot = (date: Date, hour: number) => {
    setInitialDateForCreate(date);
    const startStr = `${String(hour).padStart(2, "0")}:00`;
    const endStr = `${String(Math.min(23, hour + 1)).padStart(2, "0")}:00`;
    setInitialStartTimeForCreate(startStr);
    setInitialEndTimeForCreate(endStr);
    setEventToEdit(null);
    setIsCreateModalOpen(true);
  };

  const handleClickEvent = (event: CalendarEventItem) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };

  const handleSaveModal = async (formData: any) => {
    if (formData.id) {
      await updateMutation.mutateAsync(formData);
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    await updateMutation.mutateAsync({ id: eventId, status: newStatus });
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-5rem)] bg-background">
      {/* Sidebar */}
      <CalendarSidebar
        selectedDate={currentDate}
        onSelectDate={(d) => {
          setCurrentDate(d);
        }}
        onCreateClick={() => {
          setEventToEdit(null);
          setInitialDateForCreate(currentDate);
          setInitialStartTimeForCreate("09:00");
          setInitialEndTimeForCreate("10:00");
          setIsCreateModalOpen(true);
        }}
        filters={filters}
        onFilterChange={setFilters}
        auxData={auxData}
      />

      {/* Main Calendar View Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden p-2 md:p-4">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onViewChange={setView}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          onToday={handleToday}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex-1 relative mt-1 min-h-[500px]">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={eventsList}
              onClickDay={handleClickDay}
              onClickEvent={handleClickEvent}
            />
          )}

          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={eventsList}
              onClickSlot={handleClickSlot}
              onClickEvent={handleClickEvent}
            />
          )}

          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={eventsList}
              onClickSlot={handleClickSlot}
              onClickEvent={handleClickEvent}
            />
          )}
        </div>
      </main>

      {/* Create / Edit Modal */}
      <CalendarEventModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEventToEdit(null);
        }}
        onSubmit={handleSaveModal}
        eventToEdit={eventToEdit}
        initialDate={initialDateForCreate}
        initialStartTime={initialStartTimeForCreate}
        initialEndTime={initialEndTimeForCreate}
        auxData={auxData}
      />

      {/* Event Details Modal */}
      <CalendarEventDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        onEdit={(ev) => {
          setEventToEdit(ev);
          setIsCreateModalOpen(true);
        }}
        onCancelEvent={(id) => cancelMutation.mutateAsync(id)}
        onDeleteEvent={(id) => deleteMutation.mutateAsync(id)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
