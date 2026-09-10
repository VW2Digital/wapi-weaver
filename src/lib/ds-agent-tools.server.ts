import crypto from "crypto";
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

async function executeCrmLookup(
  tenantId: string,
  payload: any,
): Promise<{ ok: boolean; contact?: any; message?: string }> {
  const phone = String(payload.phone || payload.phone_digits || "").replace(/\D/g, "");
  const contactId = String(payload.contact_id || "").trim();
  if (!phone && !contactId) {
    return { ok: false, message: "Informe contact_id ou phone" };
  }

  const rows = contactId
    ? ((await db.query(
        `SELECT id, name, phone_e164, whatsapp_number, email, custom_fields, kanban_stage_id
         FROM contacts
         WHERE id = ? AND (tenant_id = ? OR user_id = ?)
         LIMIT 1`,
        [contactId, tenantId, tenantId],
      )) as any[])
    : ((await db.query(
        `SELECT id, name, phone_e164, whatsapp_number, email, custom_fields, kanban_stage_id
         FROM contacts
         WHERE (tenant_id = ? OR user_id = ?)
           AND (phone_e164 = ? OR whatsapp_number = ? OR REPLACE(REPLACE(phone_e164, '+', ''), ' ', '') = ?)
         LIMIT 1`,
        [tenantId, tenantId, phone, phone, phone],
      )) as any[]);

  if (!rows?.[0]) return { ok: false, message: "Contato não encontrado no CRM" };
  return { ok: true, contact: rows[0] };
}

async function executeManageTags(
  tenantId: string,
  payload: any,
): Promise<{ ok: boolean; message: string }> {
  const action = String(payload.action || "add").toLowerCase();
  const tagName = String(payload.tag_name || payload.tag || "").trim();
  const contactId = String(payload.contact_id || "").trim();
  const phone = String(payload.phone || payload.phone_digits || "").replace(/\D/g, "");

  if (!tagName) return { ok: false, message: "tag_name é obrigatório" };

  let resolvedContactId = contactId;
  if (!resolvedContactId && phone) {
    const rows = (await db.query(
      `SELECT id FROM contacts
       WHERE (tenant_id = ? OR user_id = ?)
         AND (phone_e164 = ? OR whatsapp_number = ?)
       LIMIT 1`,
      [tenantId, tenantId, phone, phone],
    )) as Array<{ id: string }>;
    resolvedContactId = rows?.[0]?.id || "";
  }
  if (!resolvedContactId) return { ok: false, message: "Contato não encontrado" };

  let tagRows = (await db.query(
    `SELECT id FROM tags WHERE tenant_id = ? AND name = ? LIMIT 1`,
    [tenantId, tagName],
  )) as Array<{ id: string }>;

  let tagId = tagRows?.[0]?.id;
  if (!tagId) {
    tagId = crypto.randomUUID();
    await db.query(
      `INSERT INTO tags (id, tenant_id, user_id, name, color) VALUES (?, ?, ?, ?, '#8B5CF6')`,
      [tagId, tenantId, tenantId, tagName],
    );
  }

  if (action === "remove") {
    await db.query(
      `DELETE FROM contact_tags WHERE contact_id = ? AND tag_id = ? AND tenant_id = ?`,
      [resolvedContactId, tagId, tenantId],
    );
    return { ok: true, message: `Tag "${tagName}" removida do contato` };
  }

  await db.query(
    `INSERT IGNORE INTO contact_tags (contact_id, tag_id, user_id, tenant_id)
     VALUES (?, ?, ?, ?)`,
    [resolvedContactId, tagId, tenantId, tenantId],
  );
  return { ok: true, message: `Tag "${tagName}" adicionada ao contato` };
}

async function executeCustomWebhook(
  config: any,
  payload: any,
): Promise<{ ok: boolean; status?: number; body?: string; message?: string }> {
  const url = String(config?.url || payload?.url || "").trim();
  if (!url) return { ok: false, message: "Webhook sem URL configurada" };

  const method = String(config?.method || payload?.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config?.headers && typeof config.headers === "object" ? config.headers : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(payload?.body || payload || {}),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 2000) };
}

/**
 * Dispatcher de ferramentas do DS Agente (calendário local, CRM, tags, webhook).
 * Nunca confiar em tenant_id/agent_id vindos do payload do LLM.
 */
export async function executeDsAgentTool(params: {
  agentId: string;
  tenantId: string;
  toolKey: string;
  payload?: any;
  toolConfig?: any;
}): Promise<any> {
  const { agentId, tenantId, toolKey, payload = {}, toolConfig } = params;
  const key = String(toolKey || "").trim();

  if (key.startsWith("calendar_") || key === "google_calendar") {
    const mapped =
      key === "google_calendar" ? String(payload.action || "calendar_list_events") : key;
    return executeDsAgentCalendarTool(agentId, tenantId, mapped, {
      ...payload,
      contact_id: payload.contact_id || undefined,
    });
  }

  if (key === "consulta_crm") {
    return executeCrmLookup(tenantId, payload);
  }

  if (key === "gerenciar_tags") {
    return executeManageTags(tenantId, payload);
  }

  if (key === "webhook_customizado") {
    return executeCustomWebhook(toolConfig || {}, payload);
  }

  if (key === "enviar_proposta") {
    return {
      ok: false,
      message: "Ferramenta enviar_proposta ainda não gera PDF automaticamente. Informe o operador humano.",
    };
  }

  throw new Error(`Ferramenta não reconhecida: ${key}`);
}
