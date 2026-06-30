import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import crypto from "crypto";

// Schemas
const funnelSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const stageSchema = z.object({
  funnel_id: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional(),
  probability_percent: z.number().min(0).max(100),
  sort_order: z.number().int().optional(),
  is_won_stage: z.boolean().optional(),
  is_lost_stage: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const opportunitySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  funnel_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  company_name: z.string().trim().max(255).nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  value: z.number().min(0),
  currency: z.string().length(3).optional(),
  expected_close_date: z.string().nullable().optional(),
  source: z.string().trim().max(100).nullable().optional(),
  temperature: z.enum(["cold", "warm", "hot"]).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  tags: z.array(z.string()).optional(),
  additional_contacts: z
    .array(
      z.object({
        contact_id: z.string().uuid(),
        role: z.string().trim().max(100).nullable().optional(),
      }),
    )
    .optional(),
});

// Helper for audit logging
async function logAudit(
  connection: any,
  userId: string,
  opportunityId: string | null,
  action: string,
  oldValues: any,
  newValues: any,
  actorId?: string,
) {
  const auditId = crypto.randomUUID();
  await connection.execute(
    `INSERT INTO opportunity_audit_logs (id, user_id, user_id_actor, opportunity_id, action, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      auditId,
      userId,
      actorId ?? userId,
      opportunityId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ],
  );
}

// Helper to check if a stage belongs to a funnel
async function validateStageBelongsToFunnel(funnelId: string, stageId: string): Promise<boolean> {
  const rows = await db.query(
    "SELECT id FROM sales_stages WHERE funnel_id = ? AND id = ? LIMIT 1",
    [funnelId, stageId],
  );
  return rows && rows.length > 0;
}

// -----------------------------------------------------------------------------
// FUNNELS ENDPOINTS
// -----------------------------------------------------------------------------

export const listFunnels = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const data = await db.query(
      "SELECT * FROM sales_funnels WHERE user_id = ? ORDER BY sort_order ASC",
      [effectiveUserId],
    );
    return data;
  });

export const createFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => funnelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const funnelId = crypto.randomUUID();
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await db.transaction(async (conn) => {
      if (data.is_default) {
        // Reset defaults
        await conn.execute("UPDATE sales_funnels SET is_default = FALSE WHERE user_id = ?", [
          effectiveUserId,
        ]);
      }

      await conn.execute(
        `INSERT INTO sales_funnels (id, user_id, name, slug, description, is_default, is_active, sort_order, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          funnelId,
          effectiveUserId,
          data.name,
          slug,
          data.description ?? null,
          data.is_default ? 1 : 0,
          data.is_active !== false ? 1 : 0,
          data.sort_order ?? 0,
          context.userId,
        ],
      );
    });

    return { id: funnelId, slug };
  });

export const updateFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), data: funnelSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const slug = data.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await db.transaction(async (conn) => {
      // Validate ownership
      const [ownerCheck]: any = await conn.execute(
        "SELECT id FROM sales_funnels WHERE id = ? AND user_id = ? LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!ownerCheck || ownerCheck.length === 0) {
        throw new Error("Funil não encontrado ou não autorizado");
      }

      if (data.data.is_default) {
        await conn.execute(
          "UPDATE sales_funnels SET is_default = FALSE WHERE user_id = ? AND id != ?",
          [effectiveUserId, data.id],
        );
      }

      await conn.execute(
        `UPDATE sales_funnels
         SET name = ?, slug = ?, description = ?, is_default = ?, is_active = ?, sort_order = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [
          data.data.name,
          slug,
          data.data.description ?? null,
          data.data.is_default ? 1 : 0,
          data.data.is_active !== false ? 1 : 0,
          data.data.sort_order ?? 0,
          context.userId,
          data.id,
        ],
      );
    });

    return { ok: true };
  });

export const deleteFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    // Check ownership
    const funnel = await db.query(
      "SELECT id FROM sales_funnels WHERE id = ? AND user_id = ? LIMIT 1",
      [data.id, effectiveUserId],
    );
    if (!funnel || funnel.length === 0) {
      throw new Error("Funil não encontrado");
    }

    // Check if funnel contains non-deleted opportunities
    const opps = await db.query(
      "SELECT id FROM opportunities WHERE funnel_id = ? AND deleted_at IS NULL LIMIT 1",
      [data.id],
    );
    if (opps && opps.length > 0) {
      throw new Error(
        "Este funil possui oportunidades ativas e não pode ser excluído. Sugerimos arquivá-lo.",
      );
    }

    await db.query("DELETE FROM sales_funnels WHERE id = ?", [data.id]);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// STAGES ENDPOINTS
// -----------------------------------------------------------------------------

export const listStages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ funnel_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const stages = await db.query(
      "SELECT * FROM sales_stages WHERE funnel_id = ? AND user_id = ? AND deleted_at IS NULL AND is_active = TRUE ORDER BY sort_order ASC",
      [data.funnel_id, effectiveUserId],
    );
    return stages;
  });

export const createStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => stageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const stageId = crypto.randomUUID();
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await db.transaction(async (conn) => {
      // Validate funnel ownership
      const [funnelCheck]: any = await conn.execute(
        "SELECT id FROM sales_funnels WHERE id = ? AND user_id = ? LIMIT 1",
        [data.funnel_id, effectiveUserId],
      );
      if (!funnelCheck || funnelCheck.length === 0) {
        throw new Error("Funil de destino inválido");
      }

      await conn.execute(
        `INSERT INTO sales_stages (id, user_id, funnel_id, name, slug, description, color, probability_percent, sort_order, is_won_stage, is_lost_stage, is_active, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stageId,
          effectiveUserId,
          data.funnel_id,
          data.name,
          slug,
          data.description ?? null,
          data.color ?? null,
          data.probability_percent,
          data.sort_order ?? 0,
          data.is_won_stage ? 1 : 0,
          data.is_lost_stage ? 1 : 0,
          data.is_active !== false ? 1 : 0,
          context.userId,
        ],
      );
    });

    return { id: stageId, slug };
  });

export const updateStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), data: stageSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const slug = data.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await db.transaction(async (conn) => {
      // Validate ownership
      const [ownerCheck]: any = await conn.execute(
        "SELECT id FROM sales_stages WHERE id = ? AND user_id = ? LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!ownerCheck || ownerCheck.length === 0) {
        throw new Error("Etapa não encontrada");
      }

      await conn.execute(
        `UPDATE sales_stages
         SET name = ?, slug = ?, description = ?, color = ?, probability_percent = ?, sort_order = ?, is_won_stage = ?, is_lost_stage = ?, is_active = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [
          data.data.name,
          slug,
          data.data.description ?? null,
          data.data.color ?? null,
          data.data.probability_percent,
          data.data.sort_order ?? 0,
          data.data.is_won_stage ? 1 : 0,
          data.data.is_lost_stage ? 1 : 0,
          data.data.is_active !== false ? 1 : 0,
          context.userId,
          data.id,
        ],
      );
    });

    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        move_opportunities_to_stage_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      // Validate ownership
      const [stage]: any = await conn.execute(
        "SELECT id, funnel_id FROM sales_stages WHERE id = ? AND user_id = ? LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!stage || stage.length === 0) {
        throw new Error("Etapa não encontrada");
      }

      // Check for opportunities in this stage
      const [opps]: any = await conn.execute(
        "SELECT id FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id],
      );

      if (opps && opps.length > 0) {
        if (!data.move_opportunities_to_stage_id) {
          throw new Error(
            "Esta etapa contém oportunidades. Você deve escolher outra etapa para mover as oportunidades.",
          );
        }

        // Validate migration stage
        const [targetStage]: any = await conn.execute(
          "SELECT id FROM sales_stages WHERE id = ? AND funnel_id = ? LIMIT 1",
          [data.move_opportunities_to_stage_id, stage[0].funnel_id],
        );
        if (!targetStage || targetStage.length === 0) {
          throw new Error("Etapa de destino para migração inválida ou pertence a outro funil");
        }

        // Move opportunities
        await conn.execute("UPDATE opportunities SET stage_id = ? WHERE stage_id = ?", [
          data.move_opportunities_to_stage_id,
          data.id,
        ]);
      }

      await conn.execute("DELETE FROM sales_stages WHERE id = ?", [data.id]);
    });

    return { ok: true };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        stages: z.array(z.object({ id: z.string().uuid(), sort_order: z.number().int() })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      // Validate ownership of the funnel
      const [funnelCheck]: any = await conn.execute(
        "SELECT id FROM sales_funnels WHERE id = ? AND user_id = ? LIMIT 1",
        [data.funnel_id, effectiveUserId],
      );
      if (!funnelCheck || funnelCheck.length === 0) {
        throw new Error("Funil não encontrado");
      }

      for (const st of data.stages) {
        await conn.execute(
          "UPDATE sales_stages SET sort_order = ? WHERE id = ? AND funnel_id = ?",
          [st.sort_order, st.id, data.funnel_id],
        );
      }
    });

    return { ok: true };
  });

// -----------------------------------------------------------------------------
// OPPORTUNITIES ENDPOINTS
// -----------------------------------------------------------------------------

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        stage_id: z.string().uuid().optional(),
        status: z.enum(["open", "won", "lost", "paused", "archived"]).optional(),
        search: z.string().optional(),
        page: z.number().int().default(1),
        limit: z.number().int().default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    let queryStr = `
      SELECT o.*, 
             c.name AS primary_contact_name, 
             c.email AS primary_contact_email,
             c.phone_e164 AS primary_contact_phone,
             c.custom_fields AS primary_contact_custom_fields
      FROM opportunities o
      LEFT JOIN contacts c ON o.primary_contact_id = c.id
      WHERE o.user_id = ? AND o.funnel_id = ? AND o.deleted_at IS NULL
    `;
    const params: any[] = [effectiveUserId, data.funnel_id];

    if (data.stage_id) {
      queryStr += " AND o.stage_id = ?";
      params.push(data.stage_id);
    }
    if (data.status) {
      queryStr += " AND o.status = ?";
      params.push(data.status);
    } else {
      // Don't show archived by default
      queryStr += " AND o.status != 'archived'";
    }

    if (data.search) {
      queryStr += " AND (o.title LIKE ? OR o.description LIKE ? OR c.name LIKE ?)";
      const likeSearch = `%${data.search}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    queryStr += " ORDER BY o.kanban_order ASC";

    // Pagination
    const offset = (data.page - 1) * data.limit;
    queryStr += " LIMIT ? OFFSET ?";
    params.push(data.limit, offset);

    const rows = await db.query(queryStr, params);

    // Parse custom fields JSON
    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (typeof row.primary_contact_custom_fields === "string") {
          try {
            row.primary_contact_custom_fields = JSON.parse(row.primary_contact_custom_fields);
          } catch (e) {
            row.primary_contact_custom_fields = {};
          }
        }
      }
    }

    // Eager load tags
    if (rows && rows.length > 0) {
      const oppIds = rows.map((r: any) => r.id);
      const placeholders = oppIds.map(() => "?").join(",");
      const tagsRows = await db.query(
        `
        SELECT ot.opportunity_id, t.name, t.color
        FROM opportunity_tags ot
        JOIN tags t ON ot.tag_id = t.id
        WHERE ot.opportunity_id IN (${placeholders})
      `,
        oppIds,
      );

      for (const row of rows) {
        row.tags = tagsRows
          .filter((tr: any) => tr.opportunity_id === row.id)
          .map((tr: any) => ({ name: tr.name, color: tr.color }));
      }
    }

    return rows;
  });

export const getOpportunity = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    // Get primary opportunity details
    const rows = await db.query(
      `
      SELECT o.*,
             c.name AS primary_contact_name,
             c.email AS primary_contact_email,
             c.phone_e164 AS primary_contact_phone,
             c.custom_fields AS primary_contact_custom_fields,
             f.name AS funnel_name,
             s.name AS stage_name,
             lr.name AS lost_reason_name
      FROM opportunities o
      LEFT JOIN contacts c ON o.primary_contact_id = c.id
      LEFT JOIN sales_funnels f ON o.funnel_id = f.id
      LEFT JOIN sales_stages s ON o.stage_id = s.id
      LEFT JOIN opportunity_lost_reasons lr ON o.lost_reason_id = lr.id
      WHERE o.id = ? AND o.user_id = ? AND o.deleted_at IS NULL
      LIMIT 1
    `,
      [data.id, effectiveUserId],
    );

    if (!rows || rows.length === 0) {
      throw new Error("Oportunidade não encontrada");
    }

    const opportunity = rows[0];
    if (typeof opportunity.primary_contact_custom_fields === "string") {
      try {
        opportunity.primary_contact_custom_fields = JSON.parse(
          opportunity.primary_contact_custom_fields,
        );
      } catch (e) {
        opportunity.primary_contact_custom_fields = {};
      }
    }

    // Load additional contacts
    opportunity.additional_contacts = await db.query(
      `
      SELECT oc.contact_id, oc.role, oc.is_primary, oc.notes, c.name, c.email, c.phone_e164
      FROM opportunity_contacts oc
      JOIN contacts c ON oc.contact_id = c.id
      WHERE oc.opportunity_id = ? AND oc.is_primary = FALSE
    `,
      [data.id],
    );

    // Load tags
    const tags = await db.query(
      `
      SELECT t.id, t.name, t.color
      FROM opportunity_tags ot
      JOIN tags t ON ot.tag_id = t.id
      WHERE ot.opportunity_id = ?
    `,
      [data.id],
    );
    opportunity.tags = tags;

    return opportunity;
  });

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => opportunitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const oppId = crypto.randomUUID();

    await db.transaction(async (conn) => {
      // Validate funnel & stage
      if (!(await validateStageBelongsToFunnel(data.funnel_id, data.stage_id))) {
        throw new Error("Etapa selecionada não pertence ao funil informado");
      }

      // Calculate kanban order (placed at the end by default)
      const [maxOrderRow]: any = await conn.execute(
        "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
        [data.stage_id],
      );
      const maxOrder = maxOrderRow?.[0]?.max_order ? parseFloat(maxOrderRow[0].max_order) : 0.0;
      const kanbanOrder = maxOrder + 1000.0;

      // Insert opportunity
      await conn.execute(
        `INSERT INTO opportunities (
           id, user_id, funnel_id, stage_id, title, description, primary_contact_id, company_name,
           owner_user_id, created_by_user_id, value, currency, expected_close_date, source, temperature, priority, kanban_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          oppId,
          effectiveUserId,
          data.funnel_id,
          data.stage_id,
          data.title,
          data.description ?? null,
          data.primary_contact_id ?? null,
          data.company_name ?? null,
          data.owner_user_id ?? effectiveUserId,
          context.userId,
          data.value,
          data.currency ?? "BRL",
          data.expected_close_date ?? null,
          data.source ?? null,
          data.temperature ?? null,
          data.priority ?? "medium",
          kanbanOrder,
        ],
      );

      // Save primary contact association in pivot table
      if (data.primary_contact_id) {
        await conn.execute(
          `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
           VALUES (UUID(), ?, ?, ?, 'Principal', TRUE)
           ON DUPLICATE KEY UPDATE is_primary = TRUE`,
          [effectiveUserId, oppId, data.primary_contact_id],
        );
      }

      // Save additional contacts
      if (data.additional_contacts && data.additional_contacts.length > 0) {
        for (const ac of data.additional_contacts) {
          await conn.execute(
            `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
             VALUES (UUID(), ?, ?, ?, ?, FALSE)
             ON DUPLICATE KEY UPDATE role = VALUES(role), is_primary = FALSE`,
            [effectiveUserId, oppId, ac.contact_id, ac.role ?? null],
          );
        }
      }

      // Tags association
      if (data.tags && data.tags.length > 0) {
        for (const tagName of data.tags) {
          // Find or create tag
          const [tag]: any = await conn.execute(
            "SELECT id FROM tags WHERE user_id = ? AND name = ? LIMIT 1",
            [effectiveUserId, tagName],
          );
          let tagId: string;
          if (tag && tag.length > 0) {
            tagId = tag[0].id;
          } else {
            tagId = crypto.randomUUID();
            await conn.execute(
              "INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, '#8B5CF6')",
              [tagId, effectiveUserId, tagName],
            );
          }
          await conn.execute(
            "INSERT INTO opportunity_tags (opportunity_id, tag_id, user_id) VALUES (?, ?, ?)",
            [oppId, tagId, effectiveUserId],
          );
        }
      }

      // Log audit
      await logAudit(conn, context.userId, oppId, "create", null, {
        title: data.title,
        value: data.value,
      });
    });

    return { id: oppId };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), data: opportunitySchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      // Validate owner
      const [oppCheck]: any = await conn.execute(
        "SELECT * FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!oppCheck || oppCheck.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const existingOpp = oppCheck[0];

      // Validate stage is in the same funnel
      if (!(await validateStageBelongsToFunnel(data.data.funnel_id, data.data.stage_id))) {
        throw new Error("Etapa não pertence ao funil selecionado");
      }

      // Update fields
      await conn.execute(
        `UPDATE opportunities
         SET title = ?, description = ?, funnel_id = ?, stage_id = ?, primary_contact_id = ?, company_name = ?,
             owner_user_id = ?, value = ?, currency = ?, expected_close_date = ?, source = ?, temperature = ?,
             priority = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [
          data.data.title,
          data.data.description ?? null,
          data.data.funnel_id,
          data.data.stage_id,
          data.data.primary_contact_id ?? null,
          data.data.company_name ?? null,
          data.data.owner_user_id ?? effectiveUserId,
          data.data.value,
          data.data.currency ?? "BRL",
          data.data.expected_close_date ?? null,
          data.data.source ?? null,
          data.data.temperature ?? null,
          data.data.priority ?? "medium",
          context.userId,
          data.id,
        ],
      );

      // Sync primary contact pivot
      await conn.execute(
        "DELETE FROM opportunity_contacts WHERE opportunity_id = ? AND is_primary = TRUE",
        [data.id],
      );
      if (data.data.primary_contact_id) {
        await conn.execute(
          `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
           VALUES (UUID(), ?, ?, ?, 'Principal', TRUE)`,
          [effectiveUserId, data.id, data.data.primary_contact_id],
        );
      }

      // Sync additional contacts
      await conn.execute(
        "DELETE FROM opportunity_contacts WHERE opportunity_id = ? AND is_primary = FALSE",
        [data.id],
      );
      if (data.data.additional_contacts && data.data.additional_contacts.length > 0) {
        for (const ac of data.data.additional_contacts) {
          await conn.execute(
            `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
             VALUES (UUID(), ?, ?, ?, ?, FALSE)`,
            [effectiveUserId, data.id, ac.contact_id, ac.role ?? null],
          );
        }
      }

      // Sync tags
      await conn.execute("DELETE FROM opportunity_tags WHERE opportunity_id = ?", [data.id]);
      if (data.data.tags && data.data.tags.length > 0) {
        for (const tagName of data.data.tags) {
          const [tag]: any = await conn.execute(
            "SELECT id FROM tags WHERE user_id = ? AND name = ? LIMIT 1",
            [effectiveUserId, tagName],
          );
          let tagId: string;
          if (tag && tag.length > 0) {
            tagId = tag[0].id;
          } else {
            tagId = crypto.randomUUID();
            await conn.execute(
              "INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, '#8B5CF6')",
              [tagId, effectiveUserId, tagName],
            );
          }
          await conn.execute(
            "INSERT INTO opportunity_tags (opportunity_id, tag_id, user_id) VALUES (?, ?, ?)",
            [data.id, tagId, effectiveUserId],
          );
        }
      }

      // Log audit
      await logAudit(conn, context.userId, data.id, "update", existingOpp, data.data);
    });

    return { ok: true };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    // Soft delete
    await db.query(
      "UPDATE opportunities SET deleted_at = NOW(), updated_by_user_id = ? WHERE id = ? AND user_id = ?",
      [context.userId, data.id, effectiveUserId],
    );

    // Audit log
    const auditConn = db;
    const opp = await db.query("SELECT title FROM opportunities WHERE id = ?", [data.id]);
    await auditConn.query(
      `INSERT INTO opportunity_audit_logs (id, user_id, opportunity_id, action, new_values)
       VALUES (UUID(), ?, ?, 'delete', ?)`,
      [context.userId, data.id, JSON.stringify({ title: opp?.[0]?.title ?? "", deleted: true })],
    );

    return { ok: true };
  });

// Kanban Drag and Drop move opportunity
export const moveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        to_stage_id: z.string().uuid(),
        before_opportunity_id: z.string().uuid().nullable().optional(),
        after_opportunity_id: z.string().uuid().nullable().optional(),
        reason: z.string().trim().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    return await db.transaction(async (conn) => {
      // Find opportunity with lock (using plain SELECT first for simplicity, or SELECT ... FOR UPDATE)
      const [oppRows]: any = await conn.execute(
        "SELECT * FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!oppRows || oppRows.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const opportunity = oppRows[0];
      const oldStageId = opportunity.stage_id;
      const oldStatus = opportunity.status;

      // Find target stage
      const [stageRows]: any = await conn.execute(
        "SELECT * FROM sales_stages WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.to_stage_id, effectiveUserId],
      );
      if (!stageRows || stageRows.length === 0) {
        throw new Error("Etapa de destino inválida");
      }
      const toStage = stageRows[0];

      // Validate funnel match (unless changing funnel via separate change-funnel endpoint)
      if (toStage.funnel_id !== opportunity.funnel_id) {
        throw new Error(
          "Mover oportunidade entre etapas de funis diferentes não é permitido por drag-and-drop direto",
        );
      }

      // Calculate Kanban order
      let newOrder = 0.0;
      if (!data.before_opportunity_id && !data.after_opportunity_id) {
        // Only card in stage, or just append
        const [maxRow]: any = await conn.execute(
          "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
          [data.to_stage_id],
        );
        const maxVal = maxRow?.[0]?.max_order ? parseFloat(maxRow[0].max_order) : 0.0;
        newOrder = maxVal + 1000.0;
      } else if (!data.before_opportunity_id && data.after_opportunity_id) {
        // Place at very top (before the 'after' card)
        const [afterRow]: any = await conn.execute(
          "SELECT kanban_order FROM opportunities WHERE id = ? LIMIT 1",
          [data.after_opportunity_id as string],
        );
        const afterVal = afterRow?.[0]?.kanban_order ? parseFloat(afterRow[0].kanban_order) : 0.0;
        newOrder = afterVal - 1000.0;
      } else if (data.before_opportunity_id && !data.after_opportunity_id) {
        // Place at bottom (after the 'before' card)
        const [beforeRow]: any = await conn.execute(
          "SELECT kanban_order FROM opportunities WHERE id = ? LIMIT 1",
          [data.before_opportunity_id as string],
        );
        const beforeVal = beforeRow?.[0]?.kanban_order
          ? parseFloat(beforeRow[0].kanban_order)
          : 0.0;
        newOrder = beforeVal + 1000.0;
      } else {
        // Between two cards
        const [beforeRow]: any = await conn.execute(
          "SELECT kanban_order FROM opportunities WHERE id = ? LIMIT 1",
          [data.before_opportunity_id as string],
        );
        const [afterRow]: any = await conn.execute(
          "SELECT kanban_order FROM opportunities WHERE id = ? LIMIT 1",
          [data.after_opportunity_id as string],
        );
        const beforeVal = beforeRow?.[0]?.kanban_order
          ? parseFloat(beforeRow[0].kanban_order)
          : 0.0;
        const afterVal = afterRow?.[0]?.kanban_order ? parseFloat(afterRow[0].kanban_order) : 0.0;
        newOrder = (beforeVal + afterVal) / 2.0;
      }

      // Determine new status
      let newStatus = opportunity.status;
      let closedAt = opportunity.closed_at;

      if (toStage.is_won_stage) {
        newStatus = "won";
        closedAt = new Date();
      } else if (toStage.is_lost_stage) {
        newStatus = "lost";
        closedAt = new Date();
      } else {
        newStatus = "open";
        closedAt = null;
      }

      // Update opportunity
      await conn.execute(
        `UPDATE opportunities
         SET stage_id = ?, kanban_order = ?, status = ?, closed_at = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [data.to_stage_id, newOrder, newStatus, closedAt, context.userId, data.id],
      );

      // Sincronizar o campo kanban_stage_id no contato principal correspondente
      if (opportunity.primary_contact_id) {
        await conn.execute(
          "UPDATE contacts SET kanban_stage_id = ? WHERE id = ? AND user_id = ?",
          [data.to_stage_id, opportunity.primary_contact_id, effectiveUserId]
        );
      }

      // Save to stage history
      const historyId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO opportunity_stage_history (
           id, user_id, opportunity_id, funnel_id, from_stage_id, to_stage_id, moved_by_user_id, reason, old_status, new_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId,
          effectiveUserId,
          data.id,
          opportunity.funnel_id,
          oldStageId,
          data.to_stage_id,
          context.userId,
          data.reason ?? null,
          oldStatus,
          newStatus,
        ],
      );

      // Audit Log
      await logAudit(
        conn,
        context.userId,
        data.id,
        "move_stage",
        { stage_id: oldStageId, status: oldStatus },
        { stage_id: data.to_stage_id, status: newStatus },
      );

      return {
        id: data.id,
        new_stage_id: data.to_stage_id,
        status: newStatus,
        kanban_order: newOrder,
      };
    });
  });

// Mark Won
export const markOpportunityWon = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      // Get opportunity funnel
      const [opps]: any = await conn.execute(
        "SELECT funnel_id, stage_id, status FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!opps || opps.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const opportunity = opps[0];

      // Get won stage of this funnel
      const [stages]: any = await conn.execute(
        "SELECT id FROM sales_stages WHERE funnel_id = ? AND is_won_stage = TRUE AND is_active = TRUE LIMIT 1",
        [opportunity.funnel_id],
      );
      if (!stages || stages.length === 0) {
        throw new Error("Nenhuma etapa de Ganho configurada para este funil");
      }
      const wonStageId = stages[0].id;

      // Update opportunity
      await conn.execute(
        "UPDATE opportunities SET status = 'won', stage_id = ?, closed_at = NOW() WHERE id = ?",
        [wonStageId, data.id],
      );

      // History
      await conn.execute(
        `INSERT INTO opportunity_stage_history (id, user_id, opportunity_id, funnel_id, from_stage_id, to_stage_id, moved_by_user_id, old_status, new_status)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'won')`,
        [
          effectiveUserId,
          data.id,
          opportunity.funnel_id,
          opportunity.stage_id,
          wonStageId,
          context.userId,
          opportunity.status,
        ],
      );

      await logAudit(
        conn,
        context.userId,
        data.id,
        "mark_won",
        { status: opportunity.status },
        { status: "won", stage_id: wonStageId },
      );
    });

    return { ok: true };
  });

// Mark Lost
export const markOpportunityLost = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        lost_reason_id: z.string().uuid(),
        lost_reason_text: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      const [opps]: any = await conn.execute(
        "SELECT funnel_id, stage_id, status FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!opps || opps.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const opportunity = opps[0];

      // Verify reason
      const [reasons]: any = await conn.execute(
        "SELECT id FROM opportunity_lost_reasons WHERE id = ? LIMIT 1",
        [data.lost_reason_id],
      );
      if (!reasons || reasons.length === 0) {
        throw new Error("Motivo de perda inválido");
      }

      // Get lost stage
      const [stages]: any = await conn.execute(
        "SELECT id FROM sales_stages WHERE funnel_id = ? AND is_lost_stage = TRUE AND is_active = TRUE LIMIT 1",
        [opportunity.funnel_id],
      );
      if (!stages || stages.length === 0) {
        throw new Error("Nenhuma etapa de Perda configurada para este funil");
      }
      const lostStageId = stages[0].id;

      // Update opportunity
      await conn.execute(
        `UPDATE opportunities 
         SET status = 'lost', stage_id = ?, lost_reason_id = ?, lost_reason_text = ?, closed_at = NOW() 
         WHERE id = ?`,
        [lostStageId, data.lost_reason_id, data.lost_reason_text ?? null, data.id],
      );

      // History
      await conn.execute(
        `INSERT INTO opportunity_stage_history (id, user_id, opportunity_id, funnel_id, from_stage_id, to_stage_id, moved_by_user_id, old_status, new_status, reason)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'lost', ?)`,
        [
          effectiveUserId,
          data.id,
          opportunity.funnel_id,
          opportunity.stage_id,
          lostStageId,
          context.userId,
          opportunity.status,
          data.lost_reason_text ?? null,
        ],
      );

      await logAudit(
        conn,
        context.userId,
        data.id,
        "mark_lost",
        { status: opportunity.status },
        { status: "lost", lost_reason_id: data.lost_reason_id },
      );
    });

    return { ok: true };
  });

// Reopen
export const reopenOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), target_stage_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      const [opps]: any = await conn.execute(
        "SELECT funnel_id, stage_id, status FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!opps || opps.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const opportunity = opps[0];

      // Validate stage
      if (!(await validateStageBelongsToFunnel(opportunity.funnel_id, data.target_stage_id))) {
        throw new Error("Etapa inválida");
      }

      await conn.execute(
        "UPDATE opportunities SET status = 'open', stage_id = ?, closed_at = NULL, lost_reason_id = NULL, lost_reason_text = NULL WHERE id = ?",
        [data.target_stage_id, data.id],
      );

      await conn.execute(
        `INSERT INTO opportunity_stage_history (id, user_id, opportunity_id, funnel_id, from_stage_id, to_stage_id, moved_by_user_id, old_status, new_status)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          effectiveUserId,
          data.id,
          opportunity.funnel_id,
          opportunity.stage_id,
          data.target_stage_id,
          context.userId,
          opportunity.status,
        ],
      );

      await logAudit(
        conn,
        context.userId,
        data.id,
        "reopen",
        { status: opportunity.status },
        { status: "open", stage_id: data.target_stage_id },
      );
    });

    return { ok: true };
  });

// Change funnel
export const changeOpportunityFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        to_funnel_id: z.string().uuid(),
        to_stage_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      const [opps]: any = await conn.execute(
        "SELECT funnel_id, stage_id, status FROM opportunities WHERE id = ? AND user_id = ? LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!opps || opps.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const opportunity = opps[0];

      // Validate stage in target funnel
      const [stages]: any = await conn.execute(
        "SELECT id FROM sales_stages WHERE id = ? AND funnel_id = ? LIMIT 1",
        [data.to_stage_id, data.to_funnel_id],
      );
      if (!stages || stages.length === 0) {
        throw new Error("Etapa selecionada não pertence ao novo funil informado");
      }

      // Calculate Kanban order
      const [maxRow]: any = await conn.execute(
        "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
        [data.to_stage_id],
      );
      const maxVal = maxRow?.[0]?.max_order ? parseFloat(maxRow[0].max_order) : 0.0;
      const newOrder = maxVal + 1000.0;

      // Update
      await conn.execute(
        "UPDATE opportunities SET funnel_id = ?, stage_id = ?, kanban_order = ? WHERE id = ?",
        [data.to_funnel_id, data.to_stage_id, newOrder, data.id],
      );

      // Audit Log
      await logAudit(
        conn,
        context.userId,
        data.id,
        "change_funnel",
        { funnel_id: opportunity.funnel_id },
        { funnel_id: data.to_funnel_id, stage_id: data.to_stage_id },
      );
    });

    return { ok: true };
  });

// Duplicate Opportunity
export const duplicateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const newId = crypto.randomUUID();

    await db.transaction(async (conn) => {
      const [opps]: any = await conn.execute(
        "SELECT * FROM opportunities WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!opps || opps.length === 0) {
        throw new Error("Oportunidade não encontrada");
      }
      const o = opps[0];

      // Calculate Kanban order
      const [maxRow]: any = await conn.execute(
        "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
        [o.stage_id],
      );
      const maxVal = maxRow?.[0]?.max_order ? parseFloat(maxRow[0].max_order) : 0.0;
      const newOrder = maxVal + 1000.0;

      // Insert duplicate
      await conn.execute(
        `INSERT INTO opportunities (
           id, user_id, funnel_id, stage_id, title, description, primary_contact_id, company_name,
           owner_user_id, created_by_user_id, value, currency, expected_close_date, source, temperature, priority, kanban_order, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          newId,
          effectiveUserId,
          o.funnel_id,
          o.stage_id,
          `${o.title} (Cópia)`,
          o.description,
          o.primary_contact_id,
          o.company_name,
          o.owner_user_id,
          context.userId,
          o.value,
          o.currency,
          o.expected_close_date,
          o.source,
          o.temperature,
          o.priority,
          newOrder,
        ],
      );

      // Duplicate contacts association
      const [contacts]: any = await conn.execute(
        "SELECT contact_id, role, is_primary FROM opportunity_contacts WHERE opportunity_id = ?",
        [data.id],
      );
      for (const c of contacts) {
        await conn.execute(
          `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
           VALUES (UUID(), ?, ?, ?, ?, ?)`,
          [effectiveUserId, newId, c.contact_id, c.role, c.is_primary],
        );
      }

      // Duplicate tags
      const [tags]: any = await conn.execute(
        "SELECT tag_id FROM opportunity_tags WHERE opportunity_id = ?",
        [data.id],
      );
      for (const t of tags) {
        await conn.execute(
          "INSERT INTO opportunity_tags (opportunity_id, tag_id, user_id) VALUES (?, ?, ?)",
          [newId, t.tag_id, effectiveUserId],
        );
      }

      await logAudit(conn, context.userId, newId, "duplicate_from", null, {
        original_opportunity_id: data.id,
      });
    });

    return { id: newId };
  });

// -----------------------------------------------------------------------------
// ACTIVITIES ENDPOINTS
// -----------------------------------------------------------------------------

const activitySchema = z.object({
  opportunity_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable().optional(),
  assigned_to_user_id: z.string().uuid().nullable().optional(),
  type: z.enum([
    "call",
    "email",
    "meeting",
    "task",
    "note",
    "whatsapp",
    "proposal",
    "follow_up",
    "other",
  ]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["pending", "done", "canceled"]).optional(),
  due_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const listActivities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ opportunity_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = await db.query(
      `SELECT a.*, c.name AS contact_name
       FROM opportunity_activities a
       LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.opportunity_id = ? AND a.user_id = ? AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [data.opportunity_id, effectiveUserId],
    );
    return rows;
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const actId = crypto.randomUUID();

    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO opportunity_activities (
           id, user_id, opportunity_id, contact_id, assigned_to_user_id, created_by_user_id,
           type, title, description, status, due_at, completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actId,
          effectiveUserId,
          data.opportunity_id,
          data.contact_id ?? null,
          data.assigned_to_user_id ?? effectiveUserId,
          context.userId,
          data.type,
          data.title,
          data.description ?? null,
          data.status ?? "pending",
          data.due_at ?? null,
          data.status === "done" ? new Date() : null,
        ],
      );

      // Update opportunity activities datetime helper
      await updateOpportunityActivityTimestamps(conn, data.opportunity_id);
    });

    return { id: actId };
  });

export const updateActivity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), data: activitySchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      // Validate owner
      const [checks]: any = await conn.execute(
        "SELECT id FROM opportunity_activities WHERE id = ? AND user_id = ? LIMIT 1",
        [data.id, effectiveUserId],
      );
      if (!checks || checks.length === 0) {
        throw new Error("Atividade não encontrada");
      }

      await conn.execute(
        `UPDATE opportunity_activities
         SET contact_id = ?, assigned_to_user_id = ?, type = ?, title = ?, description = ?,
             status = ?, due_at = ?, completed_at = ?
         WHERE id = ?`,
        [
          data.data.contact_id ?? null,
          data.data.assigned_to_user_id ?? effectiveUserId,
          data.data.type,
          data.data.title,
          data.data.description ?? null,
          data.data.status ?? "pending",
          data.data.due_at ?? null,
          data.data.status === "done" ? (data.data.completed_at ?? new Date()) : null,
          data.id,
        ],
      );

      await updateOpportunityActivityTimestamps(conn, data.data.opportunity_id);
    });

    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), opportunity_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.transaction(async (conn) => {
      await conn.execute(
        "UPDATE opportunity_activities SET deleted_at = NOW() WHERE id = ? AND user_id = ?",
        [data.id, effectiveUserId],
      );
      await updateOpportunityActivityTimestamps(conn, data.opportunity_id);
    });
    return { ok: true };
  });

async function updateOpportunityActivityTimestamps(conn: any, opportunityId: string) {
  // Last completed activity date
  const [lastRow]: any = await conn.execute(
    `SELECT MAX(completed_at) AS last_act 
     FROM opportunity_activities 
     WHERE opportunity_id = ? AND status = 'done' AND deleted_at IS NULL`,
    [opportunityId],
  );
  // Next pending activity date
  const [nextRow]: any = await conn.execute(
    `SELECT MIN(due_at) AS next_act 
     FROM opportunity_activities 
     WHERE opportunity_id = ? AND status = 'pending' AND deleted_at IS NULL AND due_at >= NOW()`,
    [opportunityId],
  );

  const lastAct = lastRow?.[0]?.last_act ? new Date(lastRow[0].last_act) : null;
  const nextAct = nextRow?.[0]?.next_act ? new Date(nextRow[0].next_act) : null;

  await conn.execute(
    "UPDATE opportunities SET last_activity_at = ?, next_activity_at = ? WHERE id = ?",
    [lastAct, nextAct, opportunityId],
  );
}

// -----------------------------------------------------------------------------
// NOTES ENDPOINTS
// -----------------------------------------------------------------------------

export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ opportunity_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = await db.query(
      `SELECT n.*, u.email AS creator_email
       FROM opportunity_notes n
       LEFT JOIN users u ON n.user_id_creator = u.id
       WHERE n.opportunity_id = ? AND n.user_id = ? AND n.deleted_at IS NULL
       ORDER BY n.is_pinned DESC, n.created_at DESC`,
      [data.opportunity_id, effectiveUserId],
    );
    return rows;
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        body: z.string().trim().min(1),
        is_pinned: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const noteId = crypto.randomUUID();
    await db.query(
      `INSERT INTO opportunity_notes (id, user_id, opportunity_id, user_id_creator, body, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        noteId,
        effectiveUserId,
        data.opportunity_id,
        context.userId,
        data.body,
        data.is_pinned ? 1 : 0,
      ],
    );
    return { id: noteId };
  });

export const updateNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        body: z.string().trim().min(1),
        is_pinned: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query(
      `UPDATE opportunity_notes
       SET body = ?, is_pinned = ?
       WHERE id = ? AND user_id = ?`,
      [data.body, data.is_pinned ? 1 : 0, data.id, effectiveUserId],
    );
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query("UPDATE opportunity_notes SET deleted_at = NOW() WHERE id = ? AND user_id = ?", [
      data.id,
      effectiveUserId,
    ]);
    return { ok: true };
  });

// -----------------------------------------------------------------------------
// TIMELINE ENDPOINT
// -----------------------------------------------------------------------------

export const getOpportunityTimeline = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ opportunity_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    // 1. Get Stage changes
    const stageHistory = await db.query(
      `SELECT h.moved_at AS event_date, 'stage_history' AS event_type, 
              h.reason, h.old_status, h.new_status,
              s1.name AS from_stage_name, s2.name AS to_stage_name,
              u.email AS actor_email
       FROM opportunity_stage_history h
       LEFT JOIN sales_stages s1 ON h.from_stage_id = s1.id
       LEFT JOIN sales_stages s2 ON h.to_stage_id = s2.id
       LEFT JOIN users u ON h.moved_by_user_id = u.id
       WHERE h.opportunity_id = ? AND h.user_id = ?
       ORDER BY h.moved_at DESC`,
      [data.opportunity_id, effectiveUserId],
    );

    // 2. Get Notes
    const notes = await db.query(
      `SELECT n.created_at AS event_date, 'note' AS event_type,
              n.body, n.is_pinned, n.id AS note_id,
              u.email AS actor_email
       FROM opportunity_notes n
       LEFT JOIN users u ON n.user_id_creator = u.id
       WHERE n.opportunity_id = ? AND n.user_id = ? AND n.deleted_at IS NULL`,
      [data.opportunity_id, effectiveUserId],
    );

    // 3. Get Activities
    const activities = await db.query(
      `SELECT a.created_at AS event_date, 'activity' AS event_type,
              a.id AS activity_id, a.type, a.title, a.description, a.status, a.due_at, a.completed_at,
              u.email AS actor_email
       FROM opportunity_activities a
       LEFT JOIN users u ON a.created_by_user_id = u.id
       WHERE a.opportunity_id = ? AND a.user_id = ? AND a.deleted_at IS NULL`,
      [data.opportunity_id, effectiveUserId],
    );

    // Merge and sort timeline
    const timeline = [
      ...stageHistory.map((h: any) => ({ ...h, event_date: new Date(h.event_date).toISOString() })),
      ...notes.map((n: any) => ({ ...n, event_date: new Date(n.event_date).toISOString() })),
      ...activities.map((a: any) => ({ ...a, event_date: new Date(a.event_date).toISOString() })),
    ];

    timeline.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    return timeline;
  });

// -----------------------------------------------------------------------------
// DASHBOARD STATS
// -----------------------------------------------------------------------------

export const getCRMStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ funnel_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const userId = effectiveUserId;

    // 1. Total opportunities count & values (grouped by status)
    const statusSummary = await db.query(
      `SELECT status, COUNT(*) AS count, SUM(value) AS total_value
       FROM opportunities
       WHERE user_id = ? AND funnel_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [userId, data.funnel_id],
    );

    // 2. Opportunities per Stage
    const stageSummary = await db.query(
      `SELECT s.id AS stage_id, s.name AS stage_name, s.color AS stage_color,
              COUNT(o.id) AS count, COALESCE(SUM(o.value), 0) AS total_value
       FROM sales_stages s
       LEFT JOIN opportunities o ON o.stage_id = s.id AND o.deleted_at IS NULL
       WHERE s.user_id = ? AND s.funnel_id = ? AND s.deleted_at IS NULL AND s.is_active = TRUE
       GROUP BY s.id, s.name, s.color, s.sort_order
       ORDER BY s.sort_order ASC`,
      [userId, data.funnel_id],
    );

    // 3. Common Lost Reasons
    const lostReasonsSummary = await db.query(
      `SELECT lr.name AS reason, COUNT(*) AS count, SUM(o.value) AS total_value
       FROM opportunities o
       JOIN opportunity_lost_reasons lr ON o.lost_reason_id = lr.id
       WHERE o.user_id = ? AND o.funnel_id = ? AND o.status = 'lost' AND o.deleted_at IS NULL
       GROUP BY lr.id, lr.name
       ORDER BY count DESC`,
      [userId, data.funnel_id],
    );

    // 4. Time series forecast (monthly expected close date values)
    const forecastSummary = await db.query(
      `SELECT DATE_FORMAT(expected_close_date, '%Y-%m') AS month, 
              COUNT(*) AS count, SUM(value) AS total_value
       FROM opportunities
       WHERE user_id = ? AND funnel_id = ? AND status = 'open' AND expected_close_date IS NOT NULL AND deleted_at IS NULL
       GROUP BY month
       ORDER BY month ASC
       LIMIT 12`,
      [userId, data.funnel_id],
    );

    // 5. Conversion rates
    const wonCountRow = statusSummary.find((s: any) => s.status === "won");
    const lostCountRow = statusSummary.find((s: any) => s.status === "lost");
    const wonCount = wonCountRow ? Number(wonCountRow.count) : 0;
    const lostCount = lostCountRow ? Number(lostCountRow.count) : 0;
    const closedCount = wonCount + lostCount;
    const conversionRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;

    return {
      status_summary: statusSummary,
      stage_summary: stageSummary,
      lost_reasons: lostReasonsSummary,
      forecast: forecastSummary,
      conversion_rate: conversionRate,
    };
  });

// -----------------------------------------------------------------------------
// LOST REASONS ENDPOINTS
// -----------------------------------------------------------------------------

export const listLostReasons = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = await db.query(
      "SELECT * FROM opportunity_lost_reasons WHERE user_id = ? AND is_active = TRUE ORDER BY sort_order ASC",
      [effectiveUserId],
    );
    return rows;
  });

export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await db.query("SELECT id, email, display_name, full_name FROM profiles");
    return rows;
  });

const bulkAssignInput = z.object({
  contactIds: z.array(z.string().uuid()),
  funnelId: z.string().uuid(),
  stageId: z.string().uuid(),
});

export const bulkAssignToKanban = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => bulkAssignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    await db.transaction(async (conn) => {
      // Validate funnel & stage
      if (!(await validateStageBelongsToFunnel(data.funnelId, data.stageId))) {
        throw new Error("Etapa selecionada não pertence ao funil informado");
      }

      for (const contactId of data.contactIds) {
        // 1. Check if contact has an active opportunity in this funnel
        const [existing]: any = await conn.execute(
          `SELECT id FROM opportunities 
           WHERE user_id = ? AND primary_contact_id = ? AND funnel_id = ? AND deleted_at IS NULL
           LIMIT 1`,
          [effectiveUserId, contactId, data.funnelId],
        );

        const oppRow = existing?.[0];

        if (oppRow) {
          // Update existing opportunity stage
          const oppId = oppRow.id;
          
          // Get old values for auditing
          const [oldRow]: any = await conn.execute(
            "SELECT stage_id FROM opportunities WHERE id = ?",
            [oppId]
          );
          
          await conn.execute(
            `UPDATE opportunities 
             SET stage_id = ?, updated_at = CURRENT_TIMESTAMP()
             WHERE id = ?`,
            [data.stageId, oppId],
          );

          await logAudit(
            conn,
            context.userId,
            oppId,
            "update_stage",
            { stage_id: oldRow?.[0]?.stage_id },
            { stage_id: data.stageId },
          );
        } else {
          // Create new opportunity
          const oppId = crypto.randomUUID();
          
          // Fetch contact details to make a nice title
          const [contactRow]: any = await conn.execute(
            "SELECT name, phone_e164 FROM contacts WHERE id = ? LIMIT 1",
            [contactId],
          );
          const contact = contactRow?.[0];
          const name = contact?.name || contact?.phone_e164 || "Contato";
          const title = `Oportunidade - ${name}`;

          // Calculate kanban order
          const [maxOrderRow]: any = await conn.execute(
            "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
            [data.stageId],
          );
          const maxOrder = maxOrderRow?.[0]?.max_order ? parseFloat(maxOrderRow[0].max_order) : 0.0;
          const kanbanOrder = maxOrder + 1000.0;

          await conn.execute(
            `INSERT INTO opportunities (
               id, user_id, funnel_id, stage_id, title, primary_contact_id, owner_user_id, created_by_user_id, value, currency, kanban_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'BRL', ?)`,
            [
              oppId,
              effectiveUserId,
              data.funnelId,
              data.stageId,
              title,
              contactId,
              effectiveUserId,
              context.userId,
              kanbanOrder,
            ],
          );

          // Save primary contact association in pivot table
          await conn.execute(
            `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
             VALUES (UUID(), ?, ?, ?, 'Principal', TRUE)
             ON DUPLICATE KEY UPDATE is_primary = TRUE`,
            [effectiveUserId, oppId, contactId],
          );

          await logAudit(
            conn,
            context.userId,
            oppId,
            "create",
            null,
            { funnel_id: data.funnelId, stage_id: data.stageId, title },
          );
        }
      }
    });

    return { ok: true };
  });
