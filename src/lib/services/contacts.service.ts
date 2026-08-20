import { normalizeToE164 } from "../phone.js";
import db from "../db.js";
import crypto from "crypto";
import { resolveEffectiveUserId, getTenantFilter } from "../chat-helpers.js";

export async function createContactForUser(userId: string, data: any) {
  if (!userId) {
    throw new Error("createContactForUser: userId is required");
  }

  const effectiveUserId = await resolveEffectiveUserId(userId);
  const phone = normalizeToE164(data.phone);
  if (!phone) throw new Error("Telefone inválido");

  const contact = await db.transaction(async (conn) => {
    const [existing]: any = await conn.execute(
      "SELECT id, custom_fields FROM contacts WHERE user_id = ? AND phone_e164 = ? FOR UPDATE",
      [effectiveUserId, phone],
    );

    const mergedCustomFields =
      existing?.[0]?.custom_fields && typeof existing[0].custom_fields === "object"
        ? {
            ...(existing[0].custom_fields as Record<string, any>),
            ...(data.custom_fields ?? {}),
          }
        : (data.custom_fields ?? {});

    const id = existing?.[0]?.id ?? crypto.randomUUID();
    await conn.execute(
      `INSERT INTO contacts (id, user_id, tenant_id, phone_e164, name, email, custom_fields, company, position, status, responsible_user_id, source, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'manual')
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), custom_fields = VALUES(custom_fields), company = VALUES(company), position = VALUES(position), status = VALUES(status), responsible_user_id = VALUES(responsible_user_id)`,
      [
        id,
        effectiveUserId,
        effectiveUserId,
        phone,
        data.name || null,
        data.email || null,
        JSON.stringify(mergedCustomFields),
        data.company || null,
        data.position || null,
        data.status || null,
        data.responsible_user_id || null,
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

export async function updateContactForUser(userId: string, data: any) {
  if (!userId) {
    throw new Error("updateContactForUser: userId is required");
  }
  const effectiveUserId = await resolveEffectiveUserId(userId);
  const phone = normalizeToE164(data.phone);
  if (!phone) throw new Error("Telefone inválido");

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
    "SELECT custom_fields, metadata FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
    [data.id, effectiveUserId],
  )) as any[];
  const existing = existingContacts?.[0];
  if (!existing) throw new Error("Contato não encontrado");

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

  await db.query(
    `UPDATE contacts 
     SET name = ?, email = ?, phone_e164 = ?, company = ?, position = ?, status = ?, responsible_user_id = ?, source = ?, source_type = ?, source_name = ?, source_id = ?, external_id = ?, metadata = ?, opted_out = ?, channel = ?, external_contact_id = ?, custom_fields = ?, is_pinned = ?, is_archived = ?, chat_status = ?, is_unread = ?, kanban_stage_id = ?
     WHERE id = ? AND user_id = ?`,
    [
      data.name !== undefined ? data.name : null,
      data.email !== undefined ? data.email : null,
      phone,
      data.company !== undefined ? data.company : null,
      data.position !== undefined ? data.position : null,
      data.status !== undefined ? data.status : null,
      data.responsible_user_id !== undefined ? (data.responsible_user_id || null) : null,
      data.source !== undefined ? data.source : "manual",
      data.source_type !== undefined ? data.source_type : "manual",
      data.source_name !== undefined ? data.source_name : null,
      data.source_id !== undefined ? (data.source_id || null) : null,
      data.external_id !== undefined ? data.external_id : null,
      mergedMetadata ? JSON.stringify(mergedMetadata) : null,
      data.opted_out !== undefined ? data.opted_out : false,
      data.channel !== undefined ? data.channel : "whatsapp",
      data.external_contact_id !== undefined ? data.external_contact_id : null,
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
