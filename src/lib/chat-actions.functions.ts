import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import crypto from "crypto";
import db from "./db";

interface ContactPhoneRow {
  id: string;
  phone_e164?: string | null;
}

interface OpportunityStageRow {
  funnel_id: string;
}

interface OpportunityIdRow {
  id: string;
}

interface ContactSummaryRow {
  name?: string | null;
  phone_e164?: string | null;
}

interface MaxOrderRow {
  max_order?: string | number | null;
}

interface BotConversationStateRow {
  id: string;
  instance_id?: string | null;
  current_step_id?: string | null;
  last_interaction?: string | null;
  is_paused?: number | boolean | null;
  paused_until?: string | null;
  bot_active?: number | boolean | null;
  channel: string;
  provider_account_id?: string | null;
}

function normalizeActionPhone(value: string) {
  const trimmed = value.trim();

  if (
    trimmed.startsWith("ig_") ||
    trimmed.startsWith("fb_") ||
    trimmed.endsWith("@g.us") ||
    trimmed.endsWith("@temp")
  ) {
    return trimmed;
  }

  return trimmed.replace(/\D/g, "");
}

function normalizeChatStatusValue(status: string) {
  return status === "pendente" ? "aguardando" : status;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const togglePinContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isPinned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query("UPDATE contacts SET is_pinned = ? WHERE id = ? AND user_id = ?", [
        data.isPinned ? 1 : 0,
        data.contactId,
        effectiveUserId,
      ]);
      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao fixar/desafixar contato:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar contato"));
    }
  });

export const toggleArchiveContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isArchived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query("UPDATE contacts SET is_archived = ? WHERE id = ? AND user_id = ?", [
        data.isArchived ? 1 : 0,
        data.contactId,
        effectiveUserId,
      ]);
      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao arquivar/desarquivar contato:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar contato"));
    }
  });

export const updateChatStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactId: z.string().min(1),
        status: z.enum(["aguardando", "aberto", "fechado", "pendente"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const normalizedStatus = normalizeChatStatusValue(data.status);

      await db.query("UPDATE contacts SET chat_status = ? WHERE id = ? AND (user_id = ? OR tenant_id = ?)", [
        normalizedStatus,
        data.contactId,
        effectiveUserId,
        effectiveUserId,
      ]);

      const { startChatSession, answerChatSession, closeChatSession } =
        await import("./chat-sessions.functions");
      if (normalizedStatus === "aguardando") {
        await startChatSession(effectiveUserId, data.contactId, "aguardando");
      } else if (normalizedStatus === "aberto") {
        await answerChatSession(effectiveUserId, data.contactId);
      } else if (normalizedStatus === "fechado") {
        await closeChatSession(effectiveUserId, data.contactId);
      }

      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao atualizar status do chat:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar status"));
    }
  });

export const toggleUnreadContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isUnread: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const contacts = (await db.query(
        "SELECT phone_e164 FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
        [data.contactId, effectiveUserId],
      )) as Array<{ phone_e164?: string | null }>;
      const phone = contacts?.[0]?.phone_e164;

      if (!phone) {
        throw new Error("Contato não encontrado.");
      }

      await db.query("UPDATE contacts SET is_unread = ? WHERE id = ? AND user_id = ?", [
        data.isUnread ? 1 : 0,
        data.contactId,
        effectiveUserId,
      ]);

      if (!data.isUnread) {
        await db.query(
          `UPDATE direct_messages
           SET status = 'read'
           WHERE user_id = ? AND contact_phone = ? AND direction = 'incoming' AND (status IS NULL OR status != 'read')`,
          [effectiveUserId, phone],
        );
      }

      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao marcar lida/não lida:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar contato"));
    }
  });

export const setContactKanbanStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ contactId: z.string().min(1), stageId: z.string().min(1).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      await db.transaction(async (conn) => {
        // 1. Atualizar o campo kanban_stage_id no contato
        await conn.execute("UPDATE contacts SET kanban_stage_id = ? WHERE id = ? AND user_id = ?", [
          data.stageId,
          data.contactId,
          effectiveUserId,
        ]);

        if (data.stageId) {
          // 2. Buscar o funnel_id associado a essa etapa
          const [stages] = (await conn.execute(
            "SELECT funnel_id FROM sales_stages WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
            [data.stageId, effectiveUserId],
          )) as [OpportunityStageRow[], unknown];
          if (!stages || stages.length === 0) {
            throw new Error("Etapa do funil inválida ou não encontrada.");
          }
          const funnelId = stages[0].funnel_id;

          // 3. Verificar se o contato já possui uma oportunidade aberta neste funil
          const [existing] = (await conn.execute(
            `SELECT id FROM opportunities 
             WHERE user_id = ? AND primary_contact_id = ? AND funnel_id = ? AND status = 'open' AND deleted_at IS NULL
             LIMIT 1`,
            [effectiveUserId, data.contactId, funnelId],
          )) as [OpportunityIdRow[], unknown];

          if (existing && existing.length > 0) {
            // Atualizar a etapa da oportunidade existente
            const oppId = existing[0].id;
            await conn.execute(
              "UPDATE opportunities SET stage_id = ?, updated_at = CURRENT_TIMESTAMP() WHERE id = ? AND user_id = ?",
              [data.stageId, oppId, effectiveUserId],
            );
          } else {
            // Criar uma nova oportunidade no CRM
            const oppId = crypto.randomUUID();

            // Obter detalhes do contato para gerar o título
            const [contacts] = (await conn.execute(
              "SELECT name, phone_e164 FROM contacts WHERE id = ? AND user_id = ? LIMIT 1",
              [data.contactId, effectiveUserId],
            )) as [ContactSummaryRow[], unknown];
            if (!contacts || contacts.length === 0) {
              throw new Error("Contato não encontrado para criar oportunidade.");
            }
            const contactName = contacts?.[0]?.name || contacts?.[0]?.phone_e164 || "Contato";
            const title = `Oportunidade - ${contactName}`;

            // Calcular ordem no Kanban
            const [maxOrderRow] = (await conn.execute(
              "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE user_id = ? AND stage_id = ? AND deleted_at IS NULL",
              [effectiveUserId, data.stageId],
            )) as [MaxOrderRow[], unknown];
            const rawMaxOrder = maxOrderRow?.[0]?.max_order;
            const maxOrder = rawMaxOrder != null ? Number(rawMaxOrder) || 0.0 : 0.0;
            const kanbanOrder = maxOrder + 1000.0;

            // Inserir oportunidade
            await conn.execute(
              `INSERT INTO opportunities (
                 id, tenant_id, user_id, funnel_id, stage_id, title, primary_contact_id, owner_user_id, created_by_user_id, value, currency, kanban_order
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'BRL', ?)`,
              [
                oppId,
                effectiveUserId,
                effectiveUserId,
                funnelId,
                data.stageId,
                title,
                data.contactId,
                effectiveUserId,
                context.userId,
                kanbanOrder,
              ],
            );

            // Associar na tabela pivot opportunity_contacts
            await conn.execute(
              `INSERT INTO opportunity_contacts (id, tenant_id, user_id, opportunity_id, contact_id, role, is_primary)
               VALUES (UUID(), ?, ?, ?, ?, 'Principal', TRUE)
               ON DUPLICATE KEY UPDATE is_primary = TRUE`,
              [effectiveUserId, effectiveUserId, oppId, data.contactId],
            );
          }
        } else {
          // "Sem funil" apenas remove a indicação atual do contato no chat.
          // Não deve apagar oportunidades abertas do CRM.
          await conn.execute(
            `UPDATE contacts
             SET kanban_stage_id = NULL
             WHERE id = ? AND user_id = ?`,
            [data.contactId, effectiveUserId],
          );
        }
      });

      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao salvar etapa do Kanban:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar etapa do funil"));
    }
  });

export const quickSaveContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactId: z.string().min(1),
        name: z.string().trim().min(1, "Nome é obrigatório"),
        email: z
          .string()
          .trim()
          .optional()
          .nullable()
          .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido")
          .transform((val) => val || null),
        phone: z.string().trim().min(5, "Telefone é obrigatório"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const phoneDigits = normalizeActionPhone(data.phone);
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      return await db.transaction(async (conn) => {
        const [contactRows] = (await conn.execute(
          "SELECT id, phone_e164 FROM contacts WHERE id = ? AND (user_id = ? OR tenant_id = ?) LIMIT 1 FOR UPDATE",
          [data.contactId, effectiveUserId, effectiveUserId],
        )) as [ContactPhoneRow[], unknown];
        const contact = contactRows?.[0];

        if (!contact) {
          throw new Error("Contato não encontrado.");
        }

        const [existingRows] = (await conn.execute(
          "SELECT id FROM contacts WHERE (user_id = ? OR tenant_id = ?) AND phone_e164 = ? AND id != ? LIMIT 1",
          [effectiveUserId, effectiveUserId, phoneDigits, data.contactId],
        )) as [OpportunityIdRow[], unknown];
        if (existingRows && existingRows.length > 0) {
          throw new Error("Já existe outro contato cadastrado com este número de telefone.");
        }

        const previousPhone = contact.phone_e164;

        await conn.execute(
          `UPDATE contacts
           SET user_id = ?,
               tenant_id = ?,
               name = ?,
               email = ?,
               phone_e164 = ?,
               source = CASE
                 WHEN source IS NULL OR TRIM(source) = ''
                   THEN CONCAT(COALESCE(NULLIF(channel, ''), 'whatsapp'), '_chat')
                 ELSE source
               END,
               source_type = CASE
                 WHEN source_type IS NULL OR TRIM(source_type) = ''
                   THEN COALESCE(NULLIF(channel, ''), 'whatsapp')
                 ELSE source_type
               END
           WHERE id = ? AND (user_id = ? OR tenant_id = ?)`,
          [
            effectiveUserId,
            effectiveUserId,
            data.name,
            data.email || null,
            phoneDigits,
            data.contactId,
            effectiveUserId,
            effectiveUserId,
          ],
        );

        if (previousPhone && previousPhone !== phoneDigits) {
          await conn.execute(
            "UPDATE direct_messages SET contact_phone = ? WHERE user_id = ? AND contact_phone = ?",
            [phoneDigits, effectiveUserId, previousPhone],
          );

          await conn.execute(
            `UPDATE campaign_messages
             SET to_phone = ?, contact_id = COALESCE(contact_id, ?)
             WHERE user_id = ? AND (contact_id = ? OR to_phone = ?)`,
            [phoneDigits, data.contactId, effectiveUserId, data.contactId, previousPhone],
          );

          await conn.execute(
            "UPDATE conversation_assignments SET contact_phone = ? WHERE user_id = ? AND contact_phone = ?",
            [phoneDigits, effectiveUserId, previousPhone],
          );

          await conn.execute(
            "UPDATE whatsapp_flow_submissions SET contact_phone = ? WHERE user_id = ? AND contact_phone = ?",
            [phoneDigits, effectiveUserId, previousPhone],
          );

          await conn.execute(
            `INSERT IGNORE INTO conversation_tags (contact_number, tag_id, user_id)
             SELECT ?, tag_id, user_id
             FROM conversation_tags
             WHERE user_id = ? AND contact_number = ?`,
            [phoneDigits, effectiveUserId, previousPhone],
          );
          await conn.execute(
            "DELETE FROM conversation_tags WHERE user_id = ? AND contact_number = ?",
            [effectiveUserId, previousPhone],
          );

          const [botStateRows] = (await conn.execute(
            `SELECT id, instance_id, current_step_id, last_interaction, is_paused, paused_until, bot_active, channel, provider_account_id
             FROM bot_conversation_state
             WHERE user_id = ? AND contact_number = ?`,
            [effectiveUserId, previousPhone],
          )) as [BotConversationStateRow[], unknown];

          for (const row of botStateRows ?? []) {
            const [matchingStateRows] = (await conn.execute(
              `SELECT id
               FROM bot_conversation_state
               WHERE user_id = ? AND contact_number = ? AND channel = ?
                 AND ((instance_id IS NULL AND ? IS NULL) OR instance_id = ?)
               LIMIT 1`,
              [
                effectiveUserId,
                phoneDigits,
                row.channel,
                row.instance_id ?? null,
                row.instance_id ?? null,
              ],
            )) as [OpportunityIdRow[], unknown];
            const matchingStateId = matchingStateRows?.[0]?.id;

            if (matchingStateId && matchingStateId !== row.id) {
              await conn.execute(
                `UPDATE bot_conversation_state
                 SET current_step_id = COALESCE(current_step_id, ?),
                     last_interaction = CASE
                       WHEN last_interaction IS NULL THEN ?
                       WHEN ? IS NULL THEN last_interaction
                       WHEN last_interaction < ? THEN ?
                       ELSE last_interaction
                     END,
                     is_paused = CASE WHEN is_paused = 1 THEN 1 ELSE ? END,
                     paused_until = COALESCE(paused_until, ?),
                     bot_active = CASE WHEN bot_active = 1 THEN 1 ELSE ? END,
                     provider_account_id = COALESCE(provider_account_id, ?)
                 WHERE id = ?`,
                [
                  row.current_step_id ?? null,
                  row.last_interaction ?? null,
                  row.last_interaction ?? null,
                  row.last_interaction ?? null,
                  row.last_interaction ?? null,
                  row.is_paused ? 1 : 0,
                  row.paused_until ?? null,
                  row.bot_active ? 1 : 0,
                  row.provider_account_id ?? null,
                  matchingStateId,
                ],
              );
              await conn.execute("DELETE FROM bot_conversation_state WHERE id = ?", [row.id]);
            } else {
              await conn.execute(
                "UPDATE bot_conversation_state SET contact_number = ? WHERE id = ?",
                [phoneDigits, row.id],
              );
            }
          }
        }

        return { ok: true, previousPhone, phone: phoneDigits };
      });
    } catch (e: unknown) {
      console.error("Erro ao salvar dados rápidos do contato:", e);
      throw new Error(getErrorMessage(e, "Erro ao salvar contato"));
    }
  });

export const toggleBotActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactPhone: z.string().min(5),
        botActive: z.boolean(),
        channel: z.string().min(1).default("whatsapp"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const digits = normalizeActionPhone(data.contactPhone);
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const [settings] = await db.query(
        "SELECT instance_id FROM bot_settings WHERE user_id = ? LIMIT 1",
        [effectiveUserId],
      );
      const instanceId = settings?.instance_id || "default";

      const existingRows = (await db.query(
        `SELECT id
         FROM bot_conversation_state
         WHERE user_id = ? AND contact_number = ? AND channel = ?`,
        [effectiveUserId, digits, data.channel],
      )) as Array<{ id: string }>;
      const existing = existingRows?.[0];

      if (existing) {
        await db.query(
          `UPDATE bot_conversation_state
           SET bot_active = ?, is_paused = ?, tenant_id = COALESCE(tenant_id, ?)
           WHERE user_id = ? AND contact_number = ? AND channel = ?`,
          [
            data.botActive ? 1 : 0,
            data.botActive ? 0 : 1,
            effectiveUserId,
            effectiveUserId,
            digits,
            data.channel,
          ],
        );
      } else {
        const id = crypto.randomUUID();

        await db.query(
          `INSERT INTO bot_conversation_state
           (id, tenant_id, user_id, contact_number, instance_id, channel, bot_active, is_paused)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            effectiveUserId,
            effectiveUserId,
            digits,
            instanceId,
            data.channel,
            data.botActive ? 1 : 0,
            data.botActive ? 0 : 1,
          ],
        );
      }
      return { ok: true };
    } catch (e: unknown) {
      console.error("Erro ao alternar bot_active:", e);
      throw new Error(getErrorMessage(e, "Erro ao atualizar status do chatbot"));
    }
  });
