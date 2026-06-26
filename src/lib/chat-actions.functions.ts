import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import crypto from "crypto";
import db from "./db";

// 1. Alternar Pin
export const togglePinContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isPinned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await db.query("UPDATE contacts SET is_pinned = ? WHERE id = ? AND user_id = ?", [
        data.isPinned ? 1 : 0,
        data.contactId,
        context.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao fixar/desafixar contato:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
    }
  });

// 2. Alternar Arquivamento
export const toggleArchiveContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isArchived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await db.query("UPDATE contacts SET is_archived = ? WHERE id = ? AND user_id = ?", [
        data.isArchived ? 1 : 0,
        data.contactId,
        context.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao arquivar/desarquivar contato:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
    }
  });

// 3. Atualizar Status de Chat
export const updateChatStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), status: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await db.query("UPDATE contacts SET chat_status = ? WHERE id = ? AND user_id = ?", [
        data.status,
        data.contactId,
        context.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao atualizar status do chat:", e);
      throw new Error(e.message || "Erro ao atualizar status");
    }
  });

// 4. Alternar Não Lida (is_unread)
export const toggleUnreadContact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactId: z.string().min(1), isUnread: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await db.query("UPDATE contacts SET is_unread = ? WHERE id = ? AND user_id = ?", [
        data.isUnread ? 1 : 0,
        data.contactId,
        context.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao marcar lida/não lida:", e);
      throw new Error(e.message || "Erro ao atualizar contato");
    }
  });

// 5. Vincular etapa do Kanban (sales_stages)
export const setContactKanbanStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ contactId: z.string().min(1), stageId: z.string().min(1).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      // Validar se o stage pertence ao tenant
      if (data.stageId) {
        const stage = await db.query("SELECT 1 FROM sales_stages WHERE id = ? AND user_id = ?", [
          data.stageId,
          context.userId,
        ]);
        if (!stage || stage.length === 0) {
          throw new Error("Etapa do funil inválida.");
        }
      }

      await db.query("UPDATE contacts SET kanban_stage_id = ? WHERE id = ? AND user_id = ?", [
        data.stageId,
        data.contactId,
        context.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao salvar etapa do Kanban:", e);
      throw new Error(e.message || "Erro ao atualizar etapa do funil");
    }
  });

// 6. Salvar dados rápidos de contato (Nome, E-mail, Telefone)
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
      const phoneDigits = data.phone.replace(/\D/g, "");

      // Validar se o telefone já existe em outro contato do mesmo usuário
      const existing = await db.query(
        "SELECT id FROM contacts WHERE user_id = ? AND phone_e164 = ? AND id != ?",
        [context.userId, phoneDigits, data.contactId],
      );
      if (existing && existing.length > 0) {
        throw new Error("Já existe outro contato cadastrado com este número de telefone.");
      }

      await db.query(
        "UPDATE contacts SET name = ?, email = ?, phone_e164 = ? WHERE id = ? AND user_id = ?",
        [data.name, data.email || null, phoneDigits, data.contactId, context.userId],
      );
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao salvar dados rápidos do contato:", e);
      throw new Error(e.message || "Erro ao salvar contato");
    }
  });

// 7. Alternar status do bot (bot_active) para o contato
export const toggleBotActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contactPhone: z.string().min(5), botActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const digits = data.contactPhone.replace(/\D/g, "");

      // Obter ou criar o estado do bot para essa conversa
      const [existing] = await db.query(
        "SELECT id FROM bot_conversation_state WHERE user_id = ? AND contact_number = ?",
        [context.userId, digits],
      );

      if (existing) {
        await db.query(
          "UPDATE bot_conversation_state SET bot_active = ?, is_paused = ? WHERE id = ?",
          [data.botActive ? 1 : 0, data.botActive ? 0 : 1, existing.id],
        );
      } else {
        // Criar uma nova linha de estado
        const id = crypto.randomUUID();
        // Buscar instance_id das configurações do bot ou WhatsApp
        const [settings] = await db.query(
          "SELECT instance_id FROM bot_settings WHERE user_id = ? LIMIT 1",
          [context.userId],
        );
        const instanceId = settings?.instance_id || "default";

        await db.query(
          "INSERT INTO bot_conversation_state (id, user_id, contact_number, instance_id, bot_active, is_paused) VALUES (?, ?, ?, ?, ?, ?)",
          [id, context.userId, digits, instanceId, data.botActive ? 1 : 0, data.botActive ? 0 : 1],
        );
      }
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao alternar bot_active:", e);
      throw new Error(e.message || "Erro ao atualizar status do chatbot");
    }
  });
