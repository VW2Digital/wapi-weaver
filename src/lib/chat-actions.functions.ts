import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import crypto from "crypto";
import db from "./db";

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
    } catch (e: any) {
      console.error("Erro ao fixar/desafixar contato:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
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
    } catch (e: any) {
      console.error("Erro ao arquivar/desarquivar contato:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
    }
  });

export const updateChatStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), status: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query("UPDATE contacts SET chat_status = ? WHERE id = ? AND user_id = ?", [
        data.status,
        data.contactId,
        effectiveUserId,
      ]);

      const { startChatSession, answerChatSession, closeChatSession } = await import("./chat-sessions.functions");
      if (data.status === "aguardando") {
        await startChatSession(effectiveUserId, data.contactId, "aguardando");
      } else if (data.status === "aberto") {
        await answerChatSession(effectiveUserId, data.contactId);
      } else if (data.status === "fechado") {
        await closeChatSession(effectiveUserId, data.contactId);
      }

      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao atualizar status do chat:", e);
      throw new Error(e.message || "Erro ao atualizar status");
    }
  });

export const toggleUnreadContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isUnread: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query("UPDATE contacts SET is_unread = ? WHERE id = ? AND user_id = ?", [
        data.isUnread ? 1 : 0,
        data.contactId,
        effectiveUserId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao marcar lida/não lida:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
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
        await conn.execute(
          "UPDATE contacts SET kanban_stage_id = ? WHERE id = ? AND user_id = ?",
          [data.stageId, data.contactId, effectiveUserId]
        );

        if (data.stageId) {
          // 2. Buscar o funnel_id associado a essa etapa
          const [stages]: any = await conn.execute(
            "SELECT funnel_id FROM sales_stages WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
            [data.stageId, effectiveUserId]
          );
          if (!stages || stages.length === 0) {
            throw new Error("Etapa do funil inválida ou não encontrada.");
          }
          const funnelId = stages[0].funnel_id;

          // 3. Verificar se o contato já possui uma oportunidade aberta neste funil
          const [existing]: any = await conn.execute(
            `SELECT id FROM opportunities 
             WHERE user_id = ? AND primary_contact_id = ? AND funnel_id = ? AND status = 'open' AND deleted_at IS NULL
             LIMIT 1`,
            [effectiveUserId, data.contactId, funnelId]
          );

          if (existing && existing.length > 0) {
            // Atualizar a etapa da oportunidade existente
            const oppId = existing[0].id;
            await conn.execute(
              "UPDATE opportunities SET stage_id = ?, updated_at = CURRENT_TIMESTAMP() WHERE id = ?",
              [data.stageId, oppId]
            );
          } else {
            // Criar uma nova oportunidade no CRM
            const oppId = crypto.randomUUID();

            // Obter detalhes do contato para gerar o título
            const [contacts]: any = await conn.execute(
              "SELECT name, phone_e164 FROM contacts WHERE id = ? LIMIT 1",
              [data.contactId]
            );
            const contactName = contacts?.[0]?.name || contacts?.[0]?.phone_e164 || "Contato";
            const title = `Oportunidade - ${contactName}`;

            // Calcular ordem no Kanban
            const [maxOrderRow]: any = await conn.execute(
              "SELECT MAX(kanban_order) AS max_order FROM opportunities WHERE stage_id = ? AND deleted_at IS NULL",
              [data.stageId]
            );
            const maxOrder = maxOrderRow?.[0]?.max_order ? parseFloat(maxOrderRow[0].max_order) : 0.0;
            const kanbanOrder = maxOrder + 1000.0;

            // Inserir oportunidade
            await conn.execute(
              `INSERT INTO opportunities (
                 id, user_id, funnel_id, stage_id, title, primary_contact_id, owner_user_id, created_by_user_id, value, currency, kanban_order
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'BRL', ?)`,
              [
                oppId,
                effectiveUserId,
                funnelId,
                data.stageId,
                title,
                data.contactId,
                effectiveUserId,
                context.userId,
                kanbanOrder,
              ]
            );

            // Associar na tabela pivot opportunity_contacts
            await conn.execute(
              `INSERT INTO opportunity_contacts (id, user_id, opportunity_id, contact_id, role, is_primary)
               VALUES (UUID(), ?, ?, ?, 'Principal', TRUE)
               ON DUPLICATE KEY UPDATE is_primary = TRUE`,
              [effectiveUserId, oppId, data.contactId]
            );
          }
        } else {
          // 4. Se a etapa for nula (Sem funil), arquivar/marcar como deletada as oportunidades abertas do contato
          await conn.execute(
            `UPDATE opportunities 
             SET deleted_at = CURRENT_TIMESTAMP()
             WHERE user_id = ? AND primary_contact_id = ? AND status = 'open' AND deleted_at IS NULL`,
            [effectiveUserId, data.contactId]
          );
        }
      });

      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao salvar etapa do Kanban:", e);
      throw new Error(e.message || "Erro ao atualizar etapa do funil");
    }
  });

export const quickSaveContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        contactId: z.string().min(1),
        name: z.string().trim().min(1),
        email: z.string().trim().email().nullable().or(z.literal("")),
        phone: z.string().trim().min(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const phoneDigits = data.phone.startsWith("ig_") || data.phone.startsWith("fb_") ? data.phone : data.phone.replace(/\D/g, "");
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      const existing = await db.query(
        "SELECT id FROM contacts WHERE user_id = ? AND phone_e164 = ? AND id != ?",
        [effectiveUserId, phoneDigits, data.contactId],
      );
      if (existing && existing.length > 0) {
        throw new Error("Já existe outro contato cadastrado com este número de telefone.");
      }

      await db.query(
        "UPDATE contacts SET name = ?, email = ?, phone_e164 = ? WHERE id = ? AND user_id = ?",
        [data.name, data.email || null, phoneDigits, data.contactId, effectiveUserId],
      );
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao salvar dados rápidos do contato:", e);
      throw new Error(e.message || "Erro ao salvar contato");
    }
  });

export const toggleBotActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactPhone: z.string().min(5), botActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const digits = data.contactPhone.startsWith("ig_") || data.contactPhone.startsWith("fb_") ? data.contactPhone : data.contactPhone.replace(/\D/g, "");
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      const [existing] = await db.query(
        "SELECT id FROM bot_conversation_state WHERE user_id = ? AND contact_number = ?",
        [effectiveUserId, digits],
      );

      if (existing) {
        await db.query(
          "UPDATE bot_conversation_state SET bot_active = ?, is_paused = ? WHERE id = ?",
          [data.botActive ? 1 : 0, data.botActive ? 0 : 1, existing.id],
        );
      } else {
        const id = crypto.randomUUID();
        const [settings] = await db.query(
          "SELECT instance_id FROM bot_settings WHERE user_id = ? LIMIT 1",
          [effectiveUserId],
        );
        const instanceId = settings?.instance_id || "default";

        await db.query(
          "INSERT INTO bot_conversation_state (id, user_id, contact_number, instance_id, bot_active, is_paused) VALUES (?, ?, ?, ?, ?, ?)",
          [id, effectiveUserId, digits, instanceId, data.botActive ? 1 : 0, data.botActive ? 0 : 1],
        );
      }
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao alternar bot_active:", e);
      throw new Error(e.message || "Erro ao atualizar status do chatbot");
    }
  });
