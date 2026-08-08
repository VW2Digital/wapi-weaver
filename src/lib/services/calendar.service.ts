import db from "../db.js";
import crypto from "crypto";
import { resolveEffectiveUserId, getTenantFilter } from "../chat-helpers.js";
import { recordAudit } from "../audit.functions.js";
import { parseISO, format, addDays, addMinutes, isBefore, isAfter } from "date-fns";

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  event_type?: string;
  status?: string;
  start_at: string; // ISO string in UTC or with timezone offset
  end_at: string;   // ISO string in UTC or with timezone offset
  all_day?: boolean;
  timezone?: string | null;
  contact_id?: string | null;
  responsible_user_id?: string | null;
  team_id?: string | null;
  ds_agent_id?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  color?: string | null;
  recurrence_type?: string | null;
  recurrence_rule?: string | null;
  reminder_minutes?: number | null;
  created_by_type?: "user" | "ds_agent" | "system";
  created_by_agent_id?: string | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateCalendarEventInput extends Partial<CreateCalendarEventInput> {}

export interface CalendarFilters {
  responsible_user_id?: string | null;
  team_id?: string | null;
  ds_agent_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  contact_id?: string | null;
  search?: string | null;
  my_events_only?: boolean;
}

export async function resolveTenantTimezone(userId: string): Promise<string> {
  if (!userId) return "America/Sao_Paulo";
  try {
    const effectiveTenantId = await resolveEffectiveUserId(userId);
    const rows: any[] = (await db.query(
      "SELECT timezone FROM profiles WHERE id = ? LIMIT 1",
      [effectiveTenantId],
    )) as any[];
    if (rows?.[0]?.timezone) {
      return rows[0].timezone;
    }
  } catch (err) {
    console.warn("[CalendarService] Error resolving tenant timezone:", err);
  }
  return "America/Sao_Paulo";
}

function normalizeToUtcString(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    throw new Error(`Data inválida fornecida: ${dateInput}`);
  }
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function createCalendarEventForUser(userId: string, data: CreateCalendarEventInput) {
  if (!userId) throw new Error("createCalendarEventForUser: userId is required");
  if (!data.title?.trim()) throw new Error("Título do evento é obrigatório");
  if (!data.start_at || !data.end_at) throw new Error("Data inicial e final são obrigatórias");

  const effectiveTenantId = await resolveEffectiveUserId(userId);
  const userTimezone = data.timezone || (await resolveTenantTimezone(userId));

  const startUtc = normalizeToUtcString(data.start_at);
  const endUtc = normalizeToUtcString(data.end_at);

  if (new Date(endUtc) <= new Date(startUtc)) {
    throw new Error("A data final deve ser maior que a data inicial");
  }

  const createdByType = data.created_by_type || "user";
  const createdByUserId = createdByType === "user" ? userId : null;
  const createdByAgentId = createdByType === "ds_agent" ? data.created_by_agent_id || data.ds_agent_id || null : null;

  const eventId = crypto.randomUUID();

  // Check conflicts
  const conflictCheck = await checkCalendarConflictForUser(
    userId,
    startUtc,
    endUtc,
    undefined,
    data.responsible_user_id || undefined,
    data.ds_agent_id || undefined,
  );

  await db.query(
    `INSERT INTO calendar_events (
      id, tenant_id, user_id, title, description, event_type, status,
      start_at, end_at, all_day, timezone, contact_id, responsible_user_id,
      team_id, ds_agent_id, location, meeting_url, color, recurrence_type,
      recurrence_rule, reminder_minutes, created_by_type, created_by_user_id,
      created_by_agent_id, metadata
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )`,
    [
      eventId,
      effectiveTenantId,
      userId,
      data.title.trim(),
      data.description || null,
      data.event_type || "reuniao",
      data.status || "agendado",
      startUtc,
      endUtc,
      data.all_day ? 1 : 0,
      userTimezone,
      data.contact_id || null,
      data.responsible_user_id || null,
      data.team_id || null,
      data.ds_agent_id || null,
      data.location || null,
      data.meeting_url || null,
      data.color || "#7C3AED",
      data.recurrence_type || "none",
      data.recurrence_rule || null,
      data.reminder_minutes ?? null,
      createdByType,
      createdByUserId,
      createdByAgentId,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ],
  );

  const event = await getCalendarEventByIdForUser(userId, eventId);

  // Record Audit
  recordAudit({
    userId,
    action: "calendar_event.created",
    entityType: "calendar_event",
    entityId: eventId,
    metadata: {
      title: data.title,
      start_at: startUtc,
      end_at: endUtc,
      created_by_type: createdByType,
      has_conflict_warning: conflictCheck.hasConflict,
    },
  }).catch(() => {});

  return {
    event,
    conflictWarning: conflictCheck.hasConflict ? "Já existe um compromisso neste horário." : null,
    conflicts: conflictCheck.conflicts,
  };
}

export async function getCalendarEventsByRangeForUser(
  userId: string,
  startDateUtc: string,
  endDateUtc: string,
  filters: CalendarFilters = {},
) {
  if (!userId) throw new Error("getCalendarEventsByRangeForUser: userId is required");

  const { sqlWhere: tenantWhere, params: tenantParams } = await getTenantFilter(userId, "ce");

  let sql = `
    SELECT 
      ce.*,
      c.name AS contact_name,
      c.phone_e164 AS contact_phone,
      c.email AS contact_email,
      p.display_name AS responsible_name,
      p.full_name AS responsible_full_name,
      t.name AS team_name,
      dsa.name AS agent_name
    FROM calendar_events ce
    LEFT JOIN contacts c ON c.id = ce.contact_id
    LEFT JOIN profiles p ON p.id = ce.responsible_user_id
    LEFT JOIN teams t ON t.id = ce.team_id
    LEFT JOIN ds_agents dsa ON dsa.id = ce.ds_agent_id
    WHERE ${tenantWhere}
      AND ce.deleted_at IS NULL
      AND ce.end_at >= ?
      AND ce.start_at <= ?
  `;

  const startStr = normalizeToUtcString(startDateUtc);
  const endStr = normalizeToUtcString(endDateUtc);

  const params: any[] = [...tenantParams, startStr, endStr];

  if (filters.my_events_only) {
    sql += ` AND (ce.responsible_user_id = ? OR ce.user_id = ?)`;
    params.push(userId, userId);
  } else if (filters.responsible_user_id) {
    sql += ` AND ce.responsible_user_id = ?`;
    params.push(filters.responsible_user_id);
  }

  if (filters.team_id) {
    sql += ` AND ce.team_id = ?`;
    params.push(filters.team_id);
  }

  if (filters.ds_agent_id) {
    sql += ` AND ce.ds_agent_id = ?`;
    params.push(filters.ds_agent_id);
  }

  if (filters.event_type) {
    sql += ` AND ce.event_type = ?`;
    params.push(filters.event_type);
  }

  if (filters.status) {
    sql += ` AND ce.status = ?`;
    params.push(filters.status);
  }

  if (filters.contact_id) {
    sql += ` AND ce.contact_id = ?`;
    params.push(filters.contact_id);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    sql += ` AND (ce.title LIKE ? OR ce.description LIKE ? OR c.name LIKE ? OR c.phone_e164 LIKE ? OR p.display_name LIKE ?)`;
    params.push(term, term, term, term, term);
  }

  sql += ` ORDER BY ce.start_at ASC`;

  const rows: any[] = (await db.query(sql, params)) as any[];
  return rows;
}

export async function getCalendarEventByIdForUser(userId: string, eventId: string) {
  if (!userId || !eventId) throw new Error("getCalendarEventByIdForUser: userId and eventId are required");

  const { sqlWhere: tenantWhere, params: tenantParams } = await getTenantFilter(userId, "ce");

  const sql = `
    SELECT 
      ce.*,
      c.name AS contact_name,
      c.phone_e164 AS contact_phone,
      c.email AS contact_email,
      c.custom_fields AS contact_custom_fields,
      p.display_name AS responsible_name,
      p.full_name AS responsible_full_name,
      t.name AS team_name,
      dsa.name AS agent_name
    FROM calendar_events ce
    LEFT JOIN contacts c ON c.id = ce.contact_id
    LEFT JOIN profiles p ON p.id = ce.responsible_user_id
    LEFT JOIN teams t ON t.id = ce.team_id
    LEFT JOIN ds_agents dsa ON dsa.id = ce.ds_agent_id
    WHERE ${tenantWhere}
      AND ce.id = ?
      AND ce.deleted_at IS NULL
    LIMIT 1
  `;

  const rows: any[] = (await db.query(sql, [...tenantParams, eventId])) as any[];
  return rows?.[0] || null;
}

export async function updateCalendarEventForUser(userId: string, eventId: string, data: UpdateCalendarEventInput) {
  if (!userId || !eventId) throw new Error("updateCalendarEventForUser: userId and eventId are required");

  const existing = await getCalendarEventByIdForUser(userId, eventId);
  if (!existing) throw new Error("Evento não encontrado ou sem permissão de acesso");

  const setClauses: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined && data.title !== null) {
    if (!data.title.trim()) throw new Error("Título não pode ser vazio");
    setClauses.push("title = ?");
    values.push(data.title.trim());
  }

  if (data.description !== undefined) {
    setClauses.push("description = ?");
    values.push(data.description || null);
  }

  if (data.event_type !== undefined && data.event_type !== null) {
    setClauses.push("event_type = ?");
    values.push(data.event_type);
  }

  if (data.status !== undefined && data.status !== null) {
    setClauses.push("status = ?");
    values.push(data.status);
  }

  let startUtc = existing.start_at;
  let endUtc = existing.end_at;

  if (data.start_at !== undefined && data.start_at !== null) {
    startUtc = normalizeToUtcString(data.start_at);
    setClauses.push("start_at = ?");
    values.push(startUtc);
  }

  if (data.end_at !== undefined && data.end_at !== null) {
    endUtc = normalizeToUtcString(data.end_at);
    setClauses.push("end_at = ?");
    values.push(endUtc);
  }

  if (new Date(endUtc) <= new Date(startUtc)) {
    throw new Error("A data final deve ser maior que a data inicial");
  }

  if (data.all_day !== undefined) {
    setClauses.push("all_day = ?");
    values.push(data.all_day ? 1 : 0);
  }

  if (data.timezone !== undefined) {
    setClauses.push("timezone = ?");
    values.push(data.timezone || "America/Sao_Paulo");
  }

  if (data.contact_id !== undefined) {
    setClauses.push("contact_id = ?");
    values.push(data.contact_id || null);
  }

  if (data.responsible_user_id !== undefined) {
    setClauses.push("responsible_user_id = ?");
    values.push(data.responsible_user_id || null);
  }

  if (data.team_id !== undefined) {
    setClauses.push("team_id = ?");
    values.push(data.team_id || null);
  }

  if (data.ds_agent_id !== undefined) {
    setClauses.push("ds_agent_id = ?");
    values.push(data.ds_agent_id || null);
  }

  if (data.location !== undefined) {
    setClauses.push("location = ?");
    values.push(data.location || null);
  }

  if (data.meeting_url !== undefined) {
    setClauses.push("meeting_url = ?");
    values.push(data.meeting_url || null);
  }

  if (data.color !== undefined) {
    setClauses.push("color = ?");
    values.push(data.color || "#7C3AED");
  }

  if (data.reminder_minutes !== undefined) {
    setClauses.push("reminder_minutes = ?");
    values.push(data.reminder_minutes ?? null);
  }

  if (data.metadata !== undefined) {
    setClauses.push("metadata = ?");
    values.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }

  if (setClauses.length === 0) return existing;

  const conflictCheck = await checkCalendarConflictForUser(
    userId,
    startUtc,
    endUtc,
    eventId,
    data.responsible_user_id ?? existing.responsible_user_id,
    data.ds_agent_id ?? existing.ds_agent_id,
  );

  values.push(eventId, existing.tenant_id);

  await db.query(
    `UPDATE calendar_events SET ${setClauses.join(", ")} WHERE id = ? AND tenant_id = ?`,
    values,
  );

  const updatedEvent = await getCalendarEventByIdForUser(userId, eventId);

  recordAudit({
    userId,
    action: "calendar_event.updated",
    entityType: "calendar_event",
    entityId: eventId,
    metadata: {
      updated_fields: Object.keys(data),
      has_conflict_warning: conflictCheck.hasConflict,
    },
  }).catch(() => {});

  return {
    event: updatedEvent,
    conflictWarning: conflictCheck.hasConflict ? "Já existe um compromisso neste horário." : null,
    conflicts: conflictCheck.conflicts,
  };
}

export async function cancelCalendarEventForUser(userId: string, eventId: string) {
  if (!userId || !eventId) throw new Error("cancelCalendarEventForUser: userId and eventId are required");

  const existing = await getCalendarEventByIdForUser(userId, eventId);
  if (!existing) throw new Error("Evento não encontrado ou sem permissão");

  await db.query(
    "UPDATE calendar_events SET status = 'cancelled' WHERE id = ? AND tenant_id = ?",
    [eventId, existing.tenant_id],
  );

  recordAudit({
    userId,
    action: "calendar_event.cancelled",
    entityType: "calendar_event",
    entityId: eventId,
    metadata: { title: existing.title },
  }).catch(() => {});

  return { success: true };
}

export async function deleteCalendarEventForUser(userId: string, eventId: string) {
  if (!userId || !eventId) throw new Error("deleteCalendarEventForUser: userId and eventId are required");

  const existing = await getCalendarEventByIdForUser(userId, eventId);
  if (!existing) throw new Error("Evento não encontrado ou sem permissão");

  await db.query(
    "UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?",
    [eventId, existing.tenant_id],
  );

  recordAudit({
    userId,
    action: "calendar_event.deleted",
    entityType: "calendar_event",
    entityId: eventId,
    metadata: { title: existing.title },
  }).catch(() => {});

  return { success: true };
}

export async function checkCalendarConflictForUser(
  userId: string,
  startAtUtc: string,
  endAtUtc: string,
  excludeEventId?: string,
  responsibleUserId?: string,
  agentId?: string,
) {
  if (!userId) throw new Error("checkCalendarConflictForUser: userId is required");

  const { sqlWhere: tenantWhere, params: tenantParams } = await getTenantFilter(userId, "ce");

  const startStr = normalizeToUtcString(startAtUtc);
  const endStr = normalizeToUtcString(endAtUtc);

  let sql = `
    SELECT id, title, start_at, end_at, status, responsible_user_id, ds_agent_id
    FROM calendar_events ce
    WHERE ${tenantWhere}
      AND ce.deleted_at IS NULL
      AND ce.status NOT IN ('cancelled')
      AND ce.start_at < ?
      AND ce.end_at > ?
  `;

  const params: any[] = [...tenantParams, endStr, startStr];

  if (excludeEventId) {
    sql += ` AND ce.id != ?`;
    params.push(excludeEventId);
  }

  const resourceFilters: string[] = [];
  const resourceParams: any[] = [];

  if (responsibleUserId) {
    resourceFilters.push("ce.responsible_user_id = ?");
    resourceParams.push(responsibleUserId);
  }

  if (agentId) {
    resourceFilters.push("ce.ds_agent_id = ?");
    resourceParams.push(agentId);
  }

  if (resourceFilters.length > 0) {
    sql += ` AND (${resourceFilters.join(" OR ")})`;
    params.push(...resourceParams);
  }

  const conflicts: any[] = (await db.query(sql, params)) as any[];

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

export async function findNextAvailableCalendarSlots(
  userId: string,
  targetDateStr: string,
  durationMinutes: number = 30,
  agentId?: string,
  responsibleUserId?: string,
) {
  const effectiveTenantId = await resolveEffectiveUserId(userId);
  let baseDate = new Date(targetDateStr);
  if (isNaN(baseDate.getTime())) baseDate = new Date();

  // If date in past, start from now
  const now = new Date();
  if (baseDate < now) baseDate = now;

  let agentAvailabilities: any[] = [];
  if (agentId) {
    agentAvailabilities = (await db.query(
      "SELECT * FROM ds_agent_calendar_availability WHERE agent_id = ? AND tenant_id = ? AND active = true",
      [agentId, effectiveTenantId],
    )) as any[];
  }

  const slots: Array<{ start_at: string; end_at: string; date: string; time: string }> = [];

  // Search up to 7 days ahead
  for (let dayOffset = 0; dayOffset < 7 && slots.length < 3; dayOffset++) {
    const currentDayDate = addDays(baseDate, dayOffset);
    // MySQL weekday: Sunday=1 or JS getDay(): Sun=0, Mon=1...
    const jsDay = currentDayDate.getDay();
    const mysqlWeekday = jsDay === 0 ? 7 : jsDay;

    let workStartHour = 8;
    let workEndHour = 18;

    if (agentAvailabilities.length > 0) {
      const dayAvail = agentAvailabilities.find((a) => Number(a.weekday) === mysqlWeekday);
      if (!dayAvail || !dayAvail.active) {
        continue; // Day not active for agent
      }
      const [sh, sm] = String(dayAvail.start_time).split(":").map(Number);
      const [eh, em] = String(dayAvail.end_time).split(":").map(Number);
      workStartHour = sh || 8;
      workEndHour = eh || 18;
    }

    const dayStart = new Date(currentDayDate);
    dayStart.setHours(workStartHour, 0, 0, 0);

    const dayEnd = new Date(currentDayDate);
    dayEnd.setHours(workEndHour, 0, 0, 0);

    let slotCandidateStart = dayStart;
    if (dayOffset === 0 && slotCandidateStart < now) {
      // Round up to next 30 min slot
      const currentMin = now.getMinutes();
      const roundedMin = currentMin < 30 ? 30 : 60;
      slotCandidateStart = new Date(now);
      slotCandidateStart.setMinutes(roundedMin, 0, 0);
    }

    while (
      addMinutes(slotCandidateStart, durationMinutes) <= dayEnd &&
      slots.length < 3
    ) {
      const slotCandidateEnd = addMinutes(slotCandidateStart, durationMinutes);

      const conflictCheck = await checkCalendarConflictForUser(
        userId,
        slotCandidateStart.toISOString(),
        slotCandidateEnd.toISOString(),
        undefined,
        responsibleUserId,
        agentId,
      );

      if (!conflictCheck.hasConflict) {
        slots.push({
          start_at: slotCandidateStart.toISOString(),
          end_at: slotCandidateEnd.toISOString(),
          date: format(slotCandidateStart, "yyyy-MM-dd"),
          time: format(slotCandidateStart, "HH:mm"),
        });
      }

      slotCandidateStart = addMinutes(slotCandidateStart, 30); // Move forward by 30 min steps
    }
  }

  return slots;
}

export async function checkCalendarAvailabilityForUser(
  userId: string,
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  responsibleUserId?: string,
  agentId?: string,
) {
  if (!userId) throw new Error("checkCalendarAvailabilityForUser: userId is required");

  // Construct datetime strings
  const startAtIso = `${dateStr}T${startTimeStr}:00.000Z`;
  const endAtIso = `${dateStr}T${endTimeStr}:00.000Z`;

  const conflictResult = await checkCalendarConflictForUser(
    userId,
    startAtIso,
    endAtIso,
    undefined,
    responsibleUserId,
    agentId,
  );

  if (!conflictResult.hasConflict) {
    return {
      available: true,
      conflicts: [],
      alternatives: [],
    };
  }

  // Calculate real alternative slots
  const startD = new Date(startAtIso);
  const endD = new Date(endAtIso);
  const durationMin = Math.max(15, Math.round((endD.getTime() - startD.getTime()) / 60000)) || 30;

  const alternatives = await findNextAvailableCalendarSlots(
    userId,
    dateStr,
    durationMin,
    agentId,
    responsibleUserId,
  );

  return {
    available: false,
    conflicts: conflictResult.conflicts,
    alternatives,
  };
}
