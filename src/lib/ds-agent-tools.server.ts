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

const SAO_PAULO_TZ = "America/Sao_Paulo";

export function getAmericaSaoPauloNow(now: Date = new Date()): {
  year: number;
  isoDate: string;
  datePtBr: string;
  weekdayPtBr: string;
  timePtBr: string;
  clockLine: string;
} {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = Number(pick("year"));
  const day = pick("day");
  const month = pick("month");
  const weekdayPtBr = pick("weekday");
  const timePtBr = `${pick("hour")}:${pick("minute")}`;
  const isoDate = `${year}-${month}-${day}`;
  const datePtBr = `${day}/${month}/${year}`;
  return {
    year,
    isoDate,
    datePtBr,
    weekdayPtBr,
    timePtBr,
    clockLine: `HOJE é ${weekdayPtBr}, ${datePtBr} (${isoDate}), ${timePtBr} (America/Sao_Paulo). O ano corrente é ${year}.`,
  };
}

/**
 * O LLM costuma inventar anos antigos (ex: 2023). Corrige para o ano atual
 * (America/Sao_Paulo) e, se ainda ficar no passado, empurra +1 ano.
 */
export function normalizeCalendarDateTime(raw: string): string {
  const input = String(raw || "").trim();
  if (!input) return input;

  const spNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const currentYear = spNow.getFullYear();

  // Aceita "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", ISO com Z
  let normalized = input.includes("T") ? input : input.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = `${normalized}T09:00:00`;
  }
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    // Trata como horário local BR sem timezone
    normalized = normalized.replace(/\.\d+$/, "");
  }

  let d = new Date(normalized.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : normalized + "-03:00");

  if (Number.isNaN(d.getTime())) {
    // Fallback parse manual YYYY-MM-DD HH:mm
    const m = input.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (!m) return input;
    d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || 9),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
  }

  if (d.getFullYear() < currentYear) {
    d.setFullYear(currentYear);
  }

  // Ainda no passado (ex.: mês já passou neste ano) → próximo ano
  if (d.getTime() < spNow.getTime() - 5 * 60 * 1000) {
    const bumped = new Date(d);
    bumped.setFullYear(currentYear + 1);
    // Se só estava "hoje" com ano errado, preferir ano atual; se mês já passou, +1
    if (d.getMonth() < spNow.getMonth() || (d.getMonth() === spNow.getMonth() && d.getDate() < spNow.getDate())) {
      d = bumped;
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  // Persistir como datetime local (sem Z) — padrão do calendar.service
  const local = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
}

export function normalizeCalendarDateOnly(raw: string): string {
  const full = normalizeCalendarDateTime(raw.includes("T") || raw.includes(" ") ? raw : `${raw}T12:00:00`);
  return full.slice(0, 10);
}

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
      const dateStr = normalizeCalendarDateOnly(
        payload.date || new Date().toISOString().split("T")[0],
      );
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
        date: dateStr,
      };
    }

    case "calendar_create_event": {
      if (!payload.title || !payload.start_at || !payload.end_at) {
        throw new Error("calendar_create_event: 'title', 'start_at' e 'end_at' são obrigatórios");
      }

      const startAt = normalizeCalendarDateTime(String(payload.start_at));
      let endAt = normalizeCalendarDateTime(String(payload.end_at));
      // Se end ficou antes/igual start após normalizar, +30min
      if (new Date(endAt.replace(" ", "T") + "-03:00").getTime() <= new Date(startAt.replace(" ", "T") + "-03:00").getTime()) {
        const end = new Date(startAt.replace(" ", "T") + "-03:00");
        end.setMinutes(end.getMinutes() + 30);
        const pad = (n: number) => String(n).padStart(2, "0");
        const local = new Date(end.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        endAt = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
      }

      const result = await createCalendarEventForUser(safeTenantId, {
        title: payload.title,
        description: payload.description || null,
        start_at: startAt,
        end_at: endAt,
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
        normalized_start_at: startAt,
        normalized_end_at: endAt,
      };
    }

    case "calendar_update_event": {
      if (!payload.event_id) {
        throw new Error("calendar_update_event: 'event_id' é obrigatório");
      }

      const result = await updateCalendarEventForUser(safeTenantId, payload.event_id, {
        title: payload.title,
        description: payload.description,
        start_at: payload.start_at ? normalizeCalendarDateTime(String(payload.start_at)) : payload.start_at,
        end_at: payload.end_at ? normalizeCalendarDateTime(String(payload.end_at)) : payload.end_at,
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
      } else {
        startDate = `${normalizeCalendarDateOnly(String(startDate))} 00:00:00`;
        endDate = `${normalizeCalendarDateOnly(String(endDate || startDate))} 23:59:59`;
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
