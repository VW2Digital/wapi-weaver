import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/calendar/CalendarPage";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaRouteComponent,
});

function AgendaRouteComponent() {
  return <CalendarPage />;
}
