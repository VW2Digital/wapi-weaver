import { normalizeToE164 } from "../phone.js";
import db from "../db.js";
import crypto from "crypto";
import { resolveEffectiveUserId, getTenantFilter } from "../chat-helpers.js";

function normalizeOptionalPhone(raw: unknown): { phoneE164: string | null; whatsappNumber: string | null } {
  const value = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!value) return { phoneE164: null, whatsappNumber: null };
  if (value.startsWith("ig_") || value.startsWith("fb_")) {
    return { phoneE164: value, whatsappNumber: null };
  }
  const digits = normalizeToE164(value);
  return { phoneE164: digits, whatsappNumber: digits };
}

export async function createContactForUser(userId: string, data: any) {
  if (!userId) {
    throw new Error("createContactForUser: userId is required");
  }

  const effectiveUserId = await resolveEffectiveUserId(userId);
  const channel = data.channel ?? "whatsapp";
  const rawPhone = (data.phone === null || data.phone === undefined ? "" : String(data.phone).trim());

  let phoneE164: string | null = null;
  let whatsappNumber: string | null = null;

  if (channel === "webchat") {
    whatsappNumber = normalizeToE164(rawPhone) || null;
    phoneE164 = rawPhone.startsWith("wc_") ? rawPhone : null;
  } else {
    if (!rawPhone && channel !== "webchat") {
      throw new Error("Telefone é obrigatório para este canal.");
    }
    ({ phoneE164, whatsappNumber } = normalizeOptionalPhone(rawPhone));
    if (!phoneE164) throw new Error("Telefone inválido");
  }

  const contact = await db.transaction(async (conn) => {
    let existingId: string | null = null;
    let existingCustomFields: Record<string, any> = {};

    if (phoneE164) {
      const [existingRows]: any = await conn.execute(
        "SELECT id, custom_fields FROM contacts WHERE user_id = ? AND phone_e164 = ? FOR UPDATE",
        [effectiveUserId, phoneE164],
      );
      existingId = existingRows?.[0]?.id ?? null;
      existingCustomFields = existingRows?.[0]?.custom_fields ?? {};
    }

    const mergedCustomFields =
      existingCustomFields && typeof existingCustomFields === "object"
        ? { ...existingCustomFields, ...(data.custom_fields ?? {}) }
        : (data.custom_fields ?? {});

    const id = existingId ?? crypto.randomUUID();
    await conn.execute(
      `INSERT INTO contacts (
         id, user_id, tenant_id, phone_e164, name, email, custom_fields, company, position, status,
         responsible_user_id, source, source_type, channel, external_contact_id, external_id, whatsapp_number
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'manual', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         custom_fields = VALUES(custom_fields),
         company = VALUES(company),
         position = VALUES(position),
         status = VALUES(status),
         responsible_user_id = VALUES(responsible_user_id),
         channel = VALUES(channel),
         external_contact_id = COALESCE(VALUES(external_contact_id), external_contact_id),
         external_id = COALESCE(VALUES(external_id), external_id),
         whatsapp_number = VALUES(whatsapp_number)`,
      [
        id,
        effectiveUserId,
        effectiveUserId,
        phoneE164,
        data.name || null,
        data.email || null,
        JSON.stringify(mergedCustomFields),
        data.company || null,
        data.position || null,
        data.status || null,
        data.responsible_user_id || null,
        channel,
        data.external_contact_id || null,
        data.external_id || null,
        whatsappNumber,
      ],
    );
    const [rows]: any = await conn.execute("SELECT * FROM contacts WHERE id = ?", [id]);
    return rows[0];
  });

  // Notify outgoing webhooks
  try {
    const { emitEvent } = await import("../../lib/webhooks.server.js");
    emitEvent(effectiveUserId, "LEAD_CREATED", {
      id: contact.id,
      phone_e164: contact.phone_e164,
      name: contact.name,
      email: contact.email,
    }).catch(() => {});
  } catch (err) {
    // Ignore error in non-web context
  }

  return contact;
}

export async function listContactsForUser(userId: string) {
  if (!userId) {
    throw new Error("listContactsForUser: userId is required");
  }
  const { isMaster, effectiveTenantId } = await getTenantFilter(userId);
  // Registros antigos vindos do chat podem ter user_id correto e tenant_id
  // ausente ou divergente. O fallback por user_id permanece restrito ao dono
  // efetivo do tenant e permite que sejam exibidos e reparados no próximo save.
  const sqlWhere = isMaster ? "1=1" : "(tenant_id = ? OR user_id = ?)";
  const filterParams = isMaster ? [] : [effectiveTenantId, effectiveTenantId];
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const data: any[] = (await db.query(
      `SELECT * FROM contacts WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, PAGE, from],
    )) as any[];
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export async function getContactDetailForUser(userId: string, id: string) {
  if (!userId) {
    throw new Error("getContactDetailForUser: userId is required");
  }

  const { sqlWhere, params: filterParams } = await getTenantFilter(userId, "c");
  const { sqlWhere: msgWhere, params: msgParams } = await getTenantFilter(userId);
  const { sqlWhere: oppWhere, params: oppParams } = await getTenantFilter(userId, "o");

  const contacts = (await db.query(
    `SELECT c.*, ss.name AS kanban_stage_name, ss.color AS kanban_stage_color, ci_web.external_id AS webchat_external_id
     FROM contacts c
     LEFT JOIN sales_stages ss ON ss.id = c.kanban_stage_id AND ss.deleted_at IS NULL
     LEFT JOIN contact_identities ci_web ON ci_web.contact_id = c.id AND ci_web.provider = 'webchat'
     WHERE c.id = ? AND (${sqlWhere}) LIMIT 1`,
    [id, ...filterParams],
  )) as any[];
  const contact = contacts?.[0];
  if (!contact) throw new Error("Contato não encontrado");

  const threadKey = contact.phone_e164 ?? (contact.webchat_external_id ? `wc_${contact.webchat_external_id}` : null);

  const messages = (await db.query(
    `SELECT id, direction, type, body, status, metadata, created_at
     FROM direct_messages
     WHERE contact_phone = ? AND (${msgWhere})
     ORDER BY created_at DESC LIMIT 50`,
    [threadKey, ...msgParams],
  )) as any[];

  const opportunities = (await db.query(
    `SELECT o.id, o.title, o.value, o.status, o.stage_id, o.kanban_order,
            ss.name AS stage_name, ss.color AS stage_color
     FROM opportunities o
     LEFT JOIN sales_stages ss ON ss.id = o.stage_id AND ss.deleted_at IS NULL
     WHERE o.primary_contact_id = ? AND o.deleted_at IS NULL AND (${oppWhere})
     ORDER BY o.created_at DESC`,
    [id, ...oppParams],
  )) as any[];

  const oppIds = opportunities.map((o: any) => o.id);
  let notes: any[] = [];
  if (oppIds.length > 0) {
    const placeholders = oppIds.map(() => "?").join(",");
    notes = (await db.query(
      `SELECT n.*, COALESCE(p.display_name, p.full_name) AS creator_name
       FROM opportunity_notes n
       LEFT JOIN profiles p ON p.id = n.user_id_creator
       WHERE n.opportunity_id IN (${placeholders}) AND n.deleted_at IS NULL
       ORDER BY n.created_at DESC LIMIT 100`,
      oppIds,
    )) as any[];
  }

  const activities = (await db.query(
    `SELECT id, type, title, description, source_type, source_id, payload, created_at
     FROM contact_activities
     WHERE contact_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [id],
  )) as any[];

  const msgCount = messages.length;
  const totalValue = opportunities.reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);
  const openOpps = opportunities.filter((o: any) => o.status === "open").length;
  const wonOpps = opportunities.filter((o: any) => o.status === "won").length;

  return {
    contact,
    messages,
    opportunities,
    notes,
    activities,
    metrics: { msgCount, totalValue, openOpps, wonOpps },
  };
}

function computeUpdatePhone(data: any, existing: any) {
  const channel = data.channel !== undefined && data.channel !== null && data.channel !== ""
    ? data.channel
    : (existing?.channel ?? "whatsapp");
  const rawPhone = data.phone === null || data.phone === undefined ? "" : String(data.phone).trim();

  if (channel === "webchat") {
    const whatsappNumber = rawPhone ? normalizeToE164(rawPhone) || null : (existing?.whatsapp_number ?? null);
    return {
      phoneE164: existing?.phone_e164 ?? null,
      whatsappNumber,
      channel,
    };
  }

  if (!rawPhone) {
    return {
      phoneE164: existing?.phone_e164 ?? null,
      whatsappNumber: existing?.whatsapp_number ?? null,
      channel,
    };
  }

  if (rawPhone.startsWith("ig_") || rawPhone.startsWith("fb_")) {
    return { phoneE164: rawPhone, whatsappNumber: null, channel };
  }

  const digits = normalizeToE164(rawPhone);
  if (!digits) throw new Error("Telefone inválido");
  return { phoneE164: digits, whatsappNumber: digits, channel };
}

function preserveOrValue(dataValue: unknown, existingValue: unknown) {
  if (dataValue === undefined || dataValue === null) return existingValue ?? null;
  if (typeof dataValue === "string" && dataValue.trim() === "") {
    return (existingValue !== undefined && existingValue !== null ? existingValue : null) as any;
  }
  return dataValue;
}

export async function updateContactForUser(userId: string, data: any) {
  if (!userId) {
    throw new Error("updateContactForUser: userId is required");
  }
  const effectiveUserId = await resolveEffectiveUserId(userId);

  if (data.kanban_stage_id !== undefined && data.kanban_stage_id !== null) {
    const existingContacts = (await db.query(
      "SELECT kanban_stage_id FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
      [data.id, effectiveUserId],
    )) as any[];
    const currentStageId = existingContacts?.[0]?.kanban_stage_id;

    let requiredFunnelId: string | null = null;
    if (currentStageId) {
      const stages = (await db.query(
        "SELECT funnel_id FROM sales_stages WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [currentStageId, effectiveUserId],
      )) as any[];
      requiredFunnelId = stages?.[0]?.funnel_id ?? null;
    }
    if (!requiredFunnelId) {
      const funnels = (await db.query(
        "SELECT id FROM sales_funnels WHERE user_id = ? AND is_default = TRUE AND is_active = TRUE AND deleted_at IS NULL LIMIT 1",
        [effectiveUserId],
      )) as any[];
      requiredFunnelId = funnels?.[0]?.id ?? null;
    }

    if (requiredFunnelId) {
      const targetStage = (await db.query(
        "SELECT id FROM sales_stages WHERE id = ? AND funnel_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.kanban_stage_id, requiredFunnelId, effectiveUserId],
      )) as any[];
      if (!targetStage || targetStage.length === 0) {
        throw new Error("Etapa do funil inválida ou de outro funil.");
      }
    }
  }

  const existingContacts = (await db.query(
    "SELECT phone_e164, whatsapp_number, channel, external_id, external_contact_id, source, source_type, source_name, source_id, custom_fields, metadata FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
    [data.id, effectiveUserId],
  )) as any[];
  const existing = existingContacts?.[0];
  if (!existing) throw new Error("Contato não encontrado");

  const { phoneE164, whatsappNumber, channel } = computeUpdatePhone(data, existing);

  const mergedCustomFields =
    data.custom_fields !== undefined
      ? data.custom_fields
      : existing.custom_fields && typeof existing.custom_fields === "object"
        ? existing.custom_fields
        : null;

  const mergedMetadata =
    data.metadata !== undefined
      ? data.metadata
      : existing.metadata && typeof existing.metadata === "object"
        ? existing.metadata
        : null;

  const source = preserveOrValue(data.source, existing.source);
  const sourceType = preserveOrValue(data.source_type, existing.source_type);
  const sourceName = preserveOrValue(data.source_name, existing.source_name);
  const sourceId = preserveOrValue(data.source_id, existing.source_id);
  const externalId = preserveOrValue(data.external_id, existing.external_id);
  const externalContactId = preserveOrValue(data.external_contact_id, existing.external_contact_id);

  await db.query(
    `UPDATE contacts 
     SET name = ?, email = ?, phone_e164 = ?, whatsapp_number = ?, company = ?, position = ?, status = ?, responsible_user_id = ?, source = ?, source_type = ?, source_name = ?, source_id = ?, external_id = ?, metadata = ?, opted_out = ?, channel = ?, external_contact_id = ?, custom_fields = ?, is_pinned = ?, is_archived = ?, chat_status = ?, is_unread = ?, kanban_stage_id = ?
     WHERE id = ? AND user_id = ?`,
    [
      data.name !== undefined ? data.name : null,
      data.email !== undefined ? data.email : null,
      phoneE164,
      whatsappNumber,
      data.company !== undefined ? data.company : null,
      data.position !== undefined ? data.position : null,
      data.status !== undefined ? data.status : null,
      data.responsible_user_id !== undefined ? (data.responsible_user_id || null) : null,
      source,
      sourceType,
      sourceName,
      sourceId,
      externalId,
      mergedMetadata ? JSON.stringify(mergedMetadata) : null,
      data.opted_out !== undefined ? data.opted_out : false,
      channel,
      externalContactId,
      mergedCustomFields ? JSON.stringify(mergedCustomFields) : null,
      data.is_pinned !== undefined ? data.is_pinned : false,
      data.is_archived !== undefined ? data.is_archived : false,
      data.chat_status !== undefined ? data.chat_status : "aberto",
      data.is_unread !== undefined ? data.is_unread : false,
      data.kanban_stage_id !== undefined ? (data.kanban_stage_id || null) : null,
      data.id,
      effectiveUserId,
    ],
  );

  const updatedContacts = (await db.query("SELECT * FROM contacts WHERE id = ?", [data.id])) as any[];
  const updated = updatedContacts?.[0];

  try {
    const { emitEvent } = await import("../../lib/webhooks.server.js");
    emitEvent(effectiveUserId, "LEAD_UPDATED", {
      id: updated.id,
      phone_e164: updated.phone_e164,
      name: updated.name,
      email: updated.email,
    }).catch(() => {});
  } catch (err) {
    // Ignore error in non-web context
  }

  return updated;
}

export async function deleteContactForUser(userId: string, id: string) {
  if (!userId) {
    throw new Error("deleteContactForUser: userId is required");
  }
  const effectiveUserId = await resolveEffectiveUserId(userId);

  return await db.transaction(async (conn) => {
    const [contacts]: any = await conn.execute(
      "SELECT phone_e164 FROM contacts WHERE id = ? AND user_id = ?",
      [id, effectiveUserId],
    );
    const contact = contacts?.[0];

    if (contact) {
      await conn.execute(
        "DELETE FROM conversation_assignments WHERE contact_phone = ? AND user_id = ?",
        [contact.phone_e164, effectiveUserId],
      );
      await conn.execute(
        "DELETE FROM conversation_tags WHERE contact_number = ? AND user_id = ?",
        [contact.phone_e164, effectiveUserId],
      );
    }

    await conn.execute("DELETE FROM contact_tags WHERE contact_id = ?", [id]);
    await conn.execute("DELETE FROM list_contacts WHERE contact_id = ?", [id]);

    await conn.execute("DELETE FROM contacts WHERE id = ? AND user_id = ?", [
      id,
      effectiveUserId,
    ]);
    return { ok: true };
  });
}
