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
      if (data.stageId) {
        const stage = await db.query(
          "SELECT 1 FROM sales_stages WHERE id = ? AND user_id = ?",
          [data.stageId, effectiveUserId],
        );
        if (!stage || stage.length === 0) {
          throw new Error("Etapa do funil inválida.");
        }
      }

      await db.query("UPDATE contacts SET kanban_stage_id = ? WHERE id = ? AND user_id = ?", [
        data.stageId,
        data.contactId,
        effectiveUserId,
      ]);
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
      const phoneDigits = data.phone.replace(/\D/g, "");
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
      const digits = data.contactPhone.replace(/\D/g, "");
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
