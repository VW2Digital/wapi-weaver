import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import {
  createCalendarEventForUser,
  getCalendarEventsByRangeForUser,
  getCalendarEventByIdForUser,
  updateCalendarEventForUser,
  cancelCalendarEventForUser,
  deleteCalendarEventForUser,
  checkCalendarConflictForUser,
  checkCalendarAvailabilityForUser,
  resolveTenantTimezone,
} from "./services/calendar.service";
import db from "./db";
import { getTenantFilter } from "./chat-helpers";

const createEventSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  event_type: z.string().trim().max(50).optional().default("reuniao"),
  status: z.string().trim().max(50).optional().default("agendado"),
  start_at: z.string().min(1, "Data inicial é obrigatória"),
  end_at: z.string().min(1, "Data final é obrigatória"),
  all_day: z.boolean().optional().default(false),
  timezone: z.string().trim().max(100).nullable().optional(),
  contact_id: z.string().uuid().nullable().optional().or(z.literal("")),
  responsible_user_id: z.string().uuid().nullable().optional().or(z.literal("")),
  team_id: z.string().uuid().nullable().optional().or(z.literal("")),
  ds_agent_id: z.string().uuid().nullable().optional().or(z.literal("")),
  location: z.string().trim().max(500).nullable().optional(),
  meeting_url: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional().default("#7C3AED"),
  reminder_minutes: z.number().int().min(0).nullable().optional(),
  created_by_type: z.enum(["user", "ds_agent", "system"]).optional().default("user"),
  created_by_agent_id: z.string().uuid().nullable().optional(),
});

const updateEventSchema = createEventSchema.partial().extend({
  id: z.string().uuid("ID inválido"),
});

export const listCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        responsible_user_id: z.string().nullable().optional(),
        team_id: z.string().nullable().optional(),
        ds_agent_id: z.string().nullable().optional(),
        event_type: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        contact_id: z.string().nullable().optional(),
        search: z.string().nullable().optional(),
        my_events_only: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const events = await getCalendarEventsByRangeForUser(
      context.userId,
      data.startDate,
      data.endDate,
      {
        responsible_user_id: data.responsible_user_id,
        team_id: data.team_id,
        ds_agent_id: data.ds_agent_id,
        event_type: data.event_type,
        status: data.status,
        contact_id: data.contact_id,
        search: data.search,
        my_events_only: data.my_events_only,
      },
    );
    const timezone = await resolveTenantTimezone(context.userId);
    return { ok: true, events, timezone };
  });

export const getCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const event = await getCalendarEventByIdForUser(context.userId, data.id);
    if (!event) throw new Error("Evento não encontrado");
    return { ok: true, event };
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => createEventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await createCalendarEventForUser(context.userId, {
      ...data,
      created_by_type: "user",
    });
    return { ok: true, ...result };
  });

export const updateCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => updateEventSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...updateData } = data;
    const result = await updateCalendarEventForUser(context.userId, id, updateData);
    return { ok: true, ...result };
  });

export const cancelCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await cancelCalendarEventForUser(context.userId, data.id);
    return { ok: true, ...result };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await deleteCalendarEventForUser(context.userId, data.id);
    return { ok: true, ...result };
  });

export const checkCalendarConflict = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        start_at: z.string(),
        end_at: z.string(),
        exclude_id: z.string().optional(),
        responsible_user_id: z.string().optional(),
        ds_agent_id: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await checkCalendarConflictForUser(
      context.userId,
      data.start_at,
      data.end_at,
      data.exclude_id,
      data.responsible_user_id,
      data.ds_agent_id,
    );
    return { ok: true, ...result };
  });

export const checkCalendarAvailability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        date: z.string(),
        start_time: z.string(),
        end_time: z.string(),
        responsible_user_id: z.string().optional(),
        ds_agent_id: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await checkCalendarAvailabilityForUser(
      context.userId,
      data.date,
      data.start_time,
      data.end_time,
      data.responsible_user_id,
      data.ds_agent_id,
    );
    return { ok: true, ...result };
  });

export const listCalendarAuxData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { sqlWhere: tenantWhere, params: tenantParams } = await getTenantFilter(context.userId);

    // 1. Contacts
    const contacts: any[] = (await db.query(
      `SELECT id, name, phone_e164, email FROM contacts WHERE ${tenantWhere} ORDER BY name ASC LIMIT 200`,
      tenantParams,
    )) as any[];

    // 2. Users (profiles)
    const users: any[] = (await db.query(
      `SELECT id, display_name, full_name, email FROM profiles ORDER BY display_name ASC LIMIT 100`,
    )) as any[];

    // 3. Teams
    const teams: any[] = (await db.query(
      `SELECT id, name, description FROM teams WHERE ${tenantWhere} ORDER BY name ASC`,
      tenantParams,
    )) as any[];

    // 4. DS Agents
    const agents: any[] = (await db.query(
      `SELECT id, name, provider, model FROM ds_agents WHERE ${tenantWhere} ORDER BY name ASC`,
      tenantParams,
    )) as any[];

    const timezone = await resolveTenantTimezone(context.userId);

    return {
      ok: true,
      contacts: contacts || [],
      users: users || [],
      teams: teams || [],
      agents: agents || [],
      timezone,
    };
  });
