import {
  createCalendarEventForUser,
  getCalendarEventsByRangeForUser,
  getCalendarEventByIdForUser,
  updateCalendarEventForUser,
  cancelCalendarEventForUser,
  checkCalendarAvailabilityForUser,
} from "./services/calendar.service.js";
import db from "./db.js";

export async function executeDsAgentCalendarTool(
  agentId: string,
  tenantId: string,
  toolKey: string,
  payload: any = {},
) {
  if (!agentId || !tenantId) {
    throw new Error("executeDsAgentCalendarTool: agentId and tenantId are required");
  }

  // Ensure security: NEVER trust tenant_id or ds_agent_id from payload
  const safeAgentId = agentId;
  const safeTenantId = tenantId;

  switch (toolKey) {
    case "calendar_check_availability": {
      const dateStr = payload.date || new Date().toISOString().split("T")[0];
      const startTime = payload.start_time || "09:00";
      const endTime = payload.end_time || "10:00";

      const result = await checkCalendarAvailabilityForUser(
        safeTenantId,
        dateStr,
        startTime,
        endTime,
        payload.responsible_user_id || undefined,
        safeAgentId,
      );

      return {
        ok: true,
        available: result.available,
        conflicts: result.conflicts,
        alternatives: result.alternatives,
      };
    }

    case "calendar_create_event": {
      if (!payload.title || !payload.start_at || !payload.end_at) {
        throw new Error("calendar_create_event: 'title', 'start_at' e 'end_at' são obrigatórios");
      }

      const result = await createCalendarEventForUser(safeTenantId, {
        title: payload.title,
        description: payload.description || null,
        start_at: payload.start_at,
        end_at: payload.end_at,
        event_type: payload.event_type || "reuniao",
        status: payload.status || "agendado",
        contact_id: payload.contact_id || null,
        responsible_user_id: payload.responsible_user_id || null,
        team_id: payload.team_id || null,
        ds_agent_id: safeAgentId,
        location: payload.location || null,
        meeting_url: payload.meeting_url || null,
        color: payload.color || "#7C3AED",
        created_by_type: "ds_agent",
        created_by_agent_id: safeAgentId,
      });

      return {
        ok: true,
        event: result.event,
        conflictWarning: result.conflictWarning,
      };
    }

    case "calendar_update_event": {
      if (!payload.event_id) {
        throw new Error("calendar_update_event: 'event_id' é obrigatório");
      }

      const result = await updateCalendarEventForUser(safeTenantId, payload.event_id, {
        title: payload.title,
        description: payload.description,
        start_at: payload.start_at,
        end_at: payload.end_at,
        status: payload.status,
        event_type: payload.event_type,
        location: payload.location,
        meeting_url: payload.meeting_url,
      });

      return {
        ok: true,
        event: result.event,
        conflictWarning: result.conflictWarning,
      };
    }

    case "calendar_cancel_event": {
      if (!payload.event_id) {
        throw new Error("calendar_cancel_event: 'event_id' é obrigatório");
      }

      const result = await cancelCalendarEventForUser(safeTenantId, payload.event_id);
      return {
        ok: true,
        message: "Compromisso cancelado com sucesso",
        ...result,
      };
    }

    case "calendar_list_events": {
      let startDate = payload.start_date || payload.date;
      let endDate = payload.end_date || payload.date;

      if (!startDate) {
        const today = new Date();
        startDate = today.toISOString().split("T")[0] + " 00:00:00";
        const future = new Date(today);
        future.setDate(future.getDate() + 7);
        endDate = future.toISOString().split("T")[0] + " 23:59:59";
      }

      const events = await getCalendarEventsByRangeForUser(safeTenantId, startDate, endDate, {
        ds_agent_id: safeAgentId,
        contact_id: payload.contact_id || undefined,
      });

      return {
        ok: true,
        count: events.length,
        events,
      };
    }

    case "calendar_get_event": {
      if (payload.event_id) {
        const event = await getCalendarEventByIdForUser(safeTenantId, payload.event_id);
        if (!event) return { ok: false, message: "Evento não encontrado" };
        return { ok: true, event };
      }

      if (payload.contact_id || payload.date) {
        let startDate = payload.date
          ? `${payload.date} 00:00:00`
          : new Date().toISOString().split("T")[0] + " 00:00:00";
        let endDate = payload.date
          ? `${payload.date} 23:59:59`
          : new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] + " 23:59:59";

        const events = await getCalendarEventsByRangeForUser(safeTenantId, startDate, endDate, {
          contact_id: payload.contact_id || undefined,
          ds_agent_id: safeAgentId,
        });

        if (events.length === 0) {
          return { ok: false, message: "Nenhum evento encontrado para os critérios fornecidos" };
        }

        if (events.length === 1) {
          return { ok: true, event: events[0] };
        }

        return {
          ok: true,
          multiple: true,
          message: "Encontrados múltiplos eventos. Forneça o ID exato.",
          events,
        };
      }

      throw new Error(
        "calendar_get_event requer 'event_id' ou pelo menos 'contact_id' ou 'date'",
      );
    }

    default:
      throw new Error(`Ferramenta de calendário não reconhecida: ${toolKey}`);
  }
}
