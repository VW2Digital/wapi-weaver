import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { normalizeToE164 } from "@/lib/phone";
import crypto from "crypto";

const contactInput = z.object({
  phone: z.string().trim().min(8).max(32),
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().max(180).nullable().optional().or(z.literal("")),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

export const updateContactProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid(),
        avatar_url: z.string().trim().max(1000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      "SELECT id, custom_fields FROM contacts WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) throw new Error("Contato não encontrado.");

    const currentCustomFields =
      contact.custom_fields && typeof contact.custom_fields === "object"
        ? { ...(contact.custom_fields as Record<string, any>) }
        : {};

    if (data.avatar_url) {
      currentCustomFields.avatar_url = data.avatar_url;
    } else {
      delete currentCustomFields.avatar_url;
      delete currentCustomFields.photo_url;
      delete currentCustomFields.photo;
      delete currentCustomFields.picture;
      delete currentCustomFields.image_url;
      delete currentCustomFields.image;
    }

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify(currentCustomFields),
      data.id,
    ]);
    const updated = (await db.query("SELECT * FROM contacts WHERE id = ?", [data.id])) as any[];
    return updated?.[0];
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const PAGE = 1000;
    const all: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const data: any[] = (await db.query(
        `SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [effectiveUserId, PAGE, from],
      )) as any[];
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
    }
    return all;
  });

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => contactInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const phone = normalizeToE164(data.phone);
    if (!phone) throw new Error("Telefone inválido");

    return await db.transaction(async (conn) => {
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
        `INSERT INTO contacts (id, user_id, phone_e164, name, email, custom_fields, source)
         VALUES (?, ?, ?, ?, ?, ?, 'manual')
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), custom_fields = VALUES(custom_fields)`,
        [
          id,
          effectiveUserId,
          phone,
          data.name || null,
          data.email || null,
          JSON.stringify(mergedCustomFields),
        ],
      );
      const [rows]: any = await conn.execute("SELECT * FROM contacts WHERE id = ?", [id]);
      return rows[0];
    });
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    return await db.transaction(async (conn) => {
      const [contacts]: any = await conn.execute(
        "SELECT phone_e164 FROM contacts WHERE id = ? AND user_id = ?",
        [data.id, effectiveUserId],
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

      // Limpar junction tables antes de deletar o contato
      await conn.execute("DELETE FROM contact_tags WHERE contact_id = ?", [data.id]);
      await conn.execute("DELETE FROM list_contacts WHERE contact_id = ?", [data.id]);

      await conn.execute("DELETE FROM contacts WHERE id = ? AND user_id = ?", [
        data.id,
        effectiveUserId,
      ]);
      return { ok: true };
    });
  });

const updateContactInput = z.object({
  id: z.string().uuid(),
  phone: z.string().trim().min(8).max(32),
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().max(180).nullable().optional().or(z.literal("")),
  source: z.string().trim().max(255).nullable().optional(),
  opted_out: z.boolean().optional(),
  channel: z.enum(["whatsapp", "instagram", "messenger"]).optional(),
  external_contact_id: z.string().trim().max(255).nullable().optional(),
  custom_fields: z.record(z.string(), z.any()).nullable().optional(),
  is_pinned: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  chat_status: z.string().max(50).optional(),
  is_unread: z.boolean().optional(),
  kanban_stage_id: z.string().uuid().nullable().optional(),
});

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => updateContactInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

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
        const validStages = (await db.query(
          "SELECT 1 FROM sales_stages WHERE id = ? AND funnel_id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
          [data.kanban_stage_id, requiredFunnelId, effectiveUserId],
        )) as any[];
        if (!validStages?.[0]) {
          throw new Error("A etapa selecionada não pertence ao funil do contato.");
        }
      }
    }

    const fields: Record<string, any> = {
      phone_e164: phone,
      ...(data.name !== undefined ? { name: data.name || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.source !== undefined ? { source: data.source || null } : {}),
      ...(data.opted_out !== undefined ? { opted_out: data.opted_out ? 1 : 0 } : {}),
      ...(data.channel !== undefined ? { channel: data.channel } : {}),
      ...(data.external_contact_id !== undefined ? { external_contact_id: data.external_contact_id || null } : {}),
      ...(data.custom_fields !== undefined ? { custom_fields: JSON.stringify(data.custom_fields) } : {}),
      ...(data.is_pinned !== undefined ? { is_pinned: data.is_pinned ? 1 : 0 } : {}),
      ...(data.is_archived !== undefined ? { is_archived: data.is_archived ? 1 : 0 } : {}),
      ...(data.chat_status !== undefined ? { chat_status: data.chat_status } : {}),
      ...(data.is_unread !== undefined ? { is_unread: data.is_unread ? 1 : 0 } : {}),
      ...(data.kanban_stage_id !== undefined ? { kanban_stage_id: data.kanban_stage_id || null } : {}),
    };

    const setClause = Object.keys(fields).map((k) => `\`${k}\` = ?`).join(", ");
    const values = Object.values(fields);

    await db.query(
      `UPDATE contacts SET ${setClause} WHERE id = ? AND user_id = ?`,
      [...values, data.id, effectiveUserId],
    );
    const rows = await db.query("SELECT * FROM contacts WHERE id = ?", [data.id]);
    return (rows as any[])[0];
  });

export const getContactKanbanStages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ contact_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      "SELECT kanban_stage_id FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
      [data.contact_id, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) return { current_stage: null, stages: [] };

    let current_stage: any = null;
    let funnel_id: string | null = null;

    if (contact.kanban_stage_id) {
      const stages = (await db.query(
        "SELECT s.id, s.name, s.color, s.funnel_id FROM sales_stages s WHERE s.id = ? AND s.user_id = ? AND s.deleted_at IS NULL LIMIT 1",
        [contact.kanban_stage_id, effectiveUserId],
      )) as any[];
      if (stages?.[0]) {
        current_stage = stages[0];
        funnel_id = stages[0].funnel_id;
      }
    }

    if (!funnel_id) {
      const funnels = (await db.query(
        "SELECT id FROM sales_funnels WHERE user_id = ? AND is_default = TRUE AND is_active = TRUE AND deleted_at IS NULL LIMIT 1",
        [effectiveUserId],
      )) as any[];
      funnel_id = funnels?.[0]?.id ?? null;
    }

    if (!funnel_id) return { current_stage, stages: [] };

    const stages = (await db.query(
      "SELECT id, name, color FROM sales_stages WHERE funnel_id = ? AND user_id = ? AND deleted_at IS NULL AND is_active = TRUE ORDER BY sort_order ASC",
      [funnel_id, effectiveUserId],
    )) as any[];

    return { current_stage, stages };
  });

export const getContactDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      `SELECT c.*, ss.name AS kanban_stage_name, ss.color AS kanban_stage_color
       FROM contacts c
       LEFT JOIN sales_stages ss ON ss.id = c.kanban_stage_id AND ss.deleted_at IS NULL
       WHERE c.id = ? AND c.user_id = ? LIMIT 1`,
      [data.id, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) throw new Error("Contato não encontrado");

    const phone = contact.phone_e164;

    const messages = (await db.query(
      `SELECT id, direction, type, body, status, metadata, created_at
       FROM direct_messages
       WHERE user_id = ? AND contact_phone = ?
       ORDER BY created_at DESC LIMIT 50`,
      [effectiveUserId, phone],
    )) as any[];

    const opportunities = (await db.query(
      `SELECT o.id, o.title, o.value, o.status, o.stage_id, o.kanban_order,
              ss.name AS stage_name, ss.color AS stage_color
       FROM opportunities o
       LEFT JOIN sales_stages ss ON ss.id = o.stage_id AND ss.deleted_at IS NULL
       WHERE o.user_id = ? AND o.primary_contact_id = ? AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [effectiveUserId, data.id],
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

    const msgCount = messages.length;
    const totalValue = opportunities.reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);
    const openOpps = opportunities.filter((o: any) => o.status === "open").length;
    const wonOpps = opportunities.filter((o: any) => o.status === "won").length;

    return {
      contact,
      messages,
      opportunities,
      notes,
      metrics: { msgCount, totalValue, openOpps, wonOpps },
    };
  });

export const addContactNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({
      contact_id: z.string().uuid(),
      body: z.string().trim().min(1),
      is_pinned: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      "SELECT id, name, phone_e164 FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
      [data.contact_id, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) throw new Error("Contato não encontrado");

    let opps = (await db.query(
      "SELECT id, title FROM opportunities WHERE user_id = ? AND primary_contact_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
      [effectiveUserId, data.contact_id],
    )) as any[];

    let opportunityId: string;
    if (opps.length === 0) {
      const funnels = (await db.query(
        "SELECT id FROM sales_funnels WHERE user_id = ? AND is_default = TRUE AND is_active = TRUE AND deleted_at IS NULL LIMIT 1",
        [effectiveUserId],
      )) as any[];
      const funnelId = funnels?.[0]?.id;
      if (!funnelId) throw new Error("Nenhum funil padrão encontrado. Crie um funil primeiro.");

      const stages = (await db.query(
        "SELECT id FROM sales_stages WHERE funnel_id = ? AND user_id = ? AND deleted_at IS NULL AND is_active = TRUE ORDER BY sort_order ASC LIMIT 1",
        [funnelId, effectiveUserId],
      )) as any[];
      const stageId = stages?.[0]?.id;
      if (!stageId) throw new Error("Nenhuma etapa encontrada no funil padrão.");

      const name = contact.name || contact.phone_e164 || "Contato";
      opportunityId = crypto.randomUUID();
      await db.query(
        `INSERT INTO opportunities (id, user_id, funnel_id, stage_id, title, primary_contact_id, owner_user_id, created_by_user_id, value, currency, kanban_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'BRL', 0)`,
        [opportunityId, effectiveUserId, funnelId, stageId, `Oportunidade - ${name}`, data.contact_id, effectiveUserId, context.userId],
      );

      await db.query(
        `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
         VALUES (?, ?, ?, ?, 'Principal', TRUE)`,
        [crypto.randomUUID(), effectiveUserId, opportunityId, data.contact_id],
      );
    } else {
      opportunityId = opps[0].id;
    }

    const noteId = crypto.randomUUID();
    await db.query(
      `INSERT INTO opportunity_notes (id, user_id, opportunity_id, user_id_creator, body, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [noteId, effectiveUserId, opportunityId, context.userId, data.body, data.is_pinned ? 1 : 0],
    );

    const note = (await db.query(
      `SELECT n.*, COALESCE(p.display_name, p.full_name) AS creator_name
       FROM opportunity_notes n
       LEFT JOIN profiles p ON p.id = n.user_id_creator
       WHERE n.id = ? LIMIT 1`,
      [noteId],
    )) as any[];

    return note?.[0] ?? { id: noteId };
  });

const bulkInput = z.object({
  rows: z
    .array(
      z.object({
        phone: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        custom_fields: z.record(z.string(), z.any()).optional(),
      }),
    )
    .min(1)
    .max(20000),
});

export const bulkUpsertContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => bulkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const cleaned: any[] = [];
    let invalid = 0;
    for (const r of data.rows) {
      const phone = normalizeToE164(r.phone);
      if (!phone) {
        invalid++;
        continue;
      }
      cleaned.push({
        id: crypto.randomUUID(),
        user_id: effectiveUserId,
        phone_e164: phone,
        name: r.name?.toString().slice(0, 120) || null,
        email: r.email?.toString().slice(0, 180) || null,
        custom_fields: JSON.stringify(r.custom_fields ?? {}),
        source: "import",
      });
    }
    if (cleaned.length === 0) return { inserted: 0, invalid };
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const slice = cleaned.slice(i, i + chunkSize);
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
      const params = slice.flatMap((r) => [r.id, r.user_id, r.phone_e164, r.name, r.email, r.custom_fields, r.source]);
      await db.query(
        `INSERT INTO contacts (id, user_id, phone_e164, name, email, custom_fields, source)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), custom_fields = VALUES(custom_fields)`,
        params,
      );
      inserted += slice.length;
    }
    return { inserted, invalid };
  });

const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(20000) });

export const bulkDeleteContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => bulkIdsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const placeholders = data.ids.map(() => "?").join(",");

    // Limpar junction tables antes de deletar os contatos
    await db.query(
      `DELETE FROM contact_tags WHERE contact_id IN (${placeholders})`,
      data.ids,
    );
    await db.query(
      `DELETE FROM list_contacts WHERE contact_id IN (${placeholders})`,
      data.ids,
    );

    await db.query(
      `DELETE FROM contacts WHERE id IN (${placeholders}) AND user_id = ?`,
      [...data.ids, effectiveUserId],
    );
    return { deleted: data.ids.length };
  });

export const bulkSetOptOut = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({ ids: z.array(z.string().uuid()).min(1).max(20000), opted_out: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const placeholders = data.ids.map(() => "?").join(",");
    await db.query(
      `UPDATE contacts SET opted_out = ? WHERE id IN (${placeholders}) AND user_id = ?`,
      [data.opted_out ? 1 : 0, ...data.ids, effectiveUserId],
    );
    return { updated: data.ids.length };
  });

export const bulkAddContactsToList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        list_id: z.string().uuid(),
        contact_ids: z.array(z.string().uuid()).min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const values = data.contact_ids.map((cid) => [data.list_id, cid, effectiveUserId]);
    const chunkSize = 500;
    let added = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
      await db.query(
        `INSERT IGNORE INTO list_contacts (list_id, contact_id, user_id) VALUES ${placeholders}`,
        chunk.flat(),
      );
      added += chunk.length;
    }
    return { added };
  });

export const bulkAddTagToContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        tag_id: z.string().uuid(),
        contact_ids: z.array(z.string().uuid()).min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const values = data.contact_ids.map((cid) => [data.tag_id, cid, effectiveUserId]);
    const chunkSize = 500;
    let added = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?)").join(",");
      await db.query(
        `INSERT IGNORE INTO contact_tags (tag_id, contact_id, user_id) VALUES ${placeholders}`,
        chunk.flat(),
      );
      added += chunk.length;
    }
    return { added };
  });

export const autoFetchContactPhoto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactId: z.string().uuid(),
        phone: z.string().trim().min(8).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const { capturarFotoPerfilLead } = await import("@/lib/profile-photo-scraper");
    const photoUrl = await capturarFotoPerfilLead(data.phone.replace(/\D/g, ""));
    if (!photoUrl) return { photo_url: null };

    const contacts = (await db.query(
      "SELECT id, custom_fields FROM contacts WHERE id = ? AND user_id = ?",
      [data.contactId, effectiveUserId],
    )) as any[];
    const contact = contacts?.[0];
    if (!contact) return { photo_url: null };

    const currentCustomFields =
      contact.custom_fields && typeof contact.custom_fields === "object"
        ? { ...(contact.custom_fields as Record<string, unknown>) }
        : {};

    currentCustomFields.avatar_url = photoUrl;

    await db.query("UPDATE contacts SET custom_fields = ? WHERE id = ?", [
      JSON.stringify(currentCustomFields),
      data.contactId,
    ]);

    return { photo_url: photoUrl };
  });

export const removeTagFromContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        contact_id: z.string().uuid(),
        tag_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    // Verificar ownership: o contato deve pertencer ao usuário
    const contacts = (await db.query(
      "SELECT id FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
      [data.contact_id, effectiveUserId],
    )) as any[];
    if (!contacts?.[0]) throw new Error("Contato não encontrado");

    await db.query(
      "DELETE FROM contact_tags WHERE contact_id = ? AND tag_id = ?",
      [data.contact_id, data.tag_id],
    );
    return { ok: true };
  });
