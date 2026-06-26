import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import { resolveEffectiveUserId } from "./chat-helpers";
import crypto from "crypto";

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    try {
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const teams = await db.query(
        `SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
         FROM teams t 
         WHERE t.user_id = ? 
         ORDER BY t.name ASC`,
        [effectiveUserId],
      );
      return teams;
    } catch (e: any) {
      console.error("Erro ao listar equipes:", e);
      throw new Error(e.message || "Erro ao consultar equipes");
    }
  });

export const listTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ teamId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const members = await db.query(
        `SELECT tm.id, tm.team_id, tm.user_id, tm.role, p.full_name, p.display_name, u.email
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE tm.team_id = ?`,
        [data.teamId],
      );
      return members;
    } catch (e: any) {
      console.error("Erro ao listar membros da equipe:", e);
      throw new Error(e.message || "Erro ao consultar membros da equipe");
    }
  });

export const listAllAgents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    try {
      const agents = await db.query(
        `SELECT p.id, p.full_name, p.display_name, u.email
         FROM profiles p
         JOIN users u ON u.id = p.id
         ORDER BY COALESCE(p.full_name, p.display_name, u.email) ASC`,
      );
      return agents;
    } catch (e: any) {
      console.error("Erro ao listar agentes da plataforma:", e);
      throw new Error(e.message || "Erro ao consultar agentes");
    }
  });

const assignInput = z.object({
  contactPhone: z.string().trim().min(5),
  teamId: z.string().min(1).nullable(),
  agentId: z.string().min(1).nullable(),
});

export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => assignInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const phone = data.contactPhone.replace(/\D/g, "");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      // 1. Validar associação do agente com a equipe se ambos forem informados
      if (data.teamId && data.agentId) {
        const members = await db.query(
          "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?",
          [data.teamId, data.agentId],
        );
        if (!members || members.length === 0) {
          throw new Error("O agente informado não pertence a esta equipe.");
        }
      }

      // 2. Marcar a atribuição ativa anterior como inativa
      await db.query(
        `UPDATE conversation_assignments 
         SET is_active = false, unassigned_at = CURRENT_TIMESTAMP()
         WHERE user_id = ? AND contact_phone = ? AND is_active = true`,
        [effectiveUserId, phone],
      );

      // 3. Criar nova atribuição ativa (se pelo menos uma equipe ou agente foi especificado)
      if (data.teamId || data.agentId) {
        const assignmentId = crypto.randomUUID();
        await db.query(
          `INSERT INTO conversation_assignments 
            (id, user_id, contact_phone, team_id, agent_id, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [assignmentId, effectiveUserId, phone, data.teamId, data.agentId, context.userId],
        );
      }

      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao atribuir conversa:", e);
      throw new Error(e.message || "Erro ao salvar atribuição");
    }
  });

export const autoAssignConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ contactPhone: z.string().trim().min(5), teamId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const phone = data.contactPhone.replace(/\D/g, "");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);

      // Busca os membros da equipe ordenados pela menor carga atual de atendimentos ativos
      const agents = await db.query(
        `SELECT tm.user_id as agent_id, COUNT(ca.id) as active_chats
         FROM team_members tm
         LEFT JOIN conversation_assignments ca 
           ON ca.agent_id = tm.user_id AND ca.is_active = true AND ca.user_id = ?
         WHERE tm.team_id = ?
         GROUP BY tm.user_id
         ORDER BY active_chats ASC, RAND()
         LIMIT 1`,
        [effectiveUserId, data.teamId],
      );

      // Desativa a atribuição anterior
      await db.query(
        `UPDATE conversation_assignments 
         SET is_active = false, unassigned_at = CURRENT_TIMESTAMP()
         WHERE user_id = ? AND contact_phone = ? AND is_active = true`,
        [effectiveUserId, phone],
      );

      const targetAgentId = agents && agents.length > 0 ? agents[0].agent_id : null;
      const assignmentId = crypto.randomUUID();

      // Cria a nova atribuição (ao time + agente selecionado via round-robin, se disponível)
      await db.query(
        `INSERT INTO conversation_assignments 
          (id, user_id, contact_phone, team_id, agent_id, assigned_by)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [assignmentId, effectiveUserId, phone, data.teamId, targetAgentId],
      );

      return { ok: true, agentId: targetAgentId };
    } catch (e: any) {
      console.error("Erro ao auto-atribuir conversa:", e);
      throw new Error(e.message || "Erro ao auto-atribuir conversa");
    }
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        name: z.string().trim().min(1),
        description: z.string().trim().nullable(),
        autoAssignMode: z.enum(["manual", "round_robin", "least_busy"]).default("manual"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const teamId = crypto.randomUUID();
      await db.query(
        `INSERT INTO teams (id, user_id, name, description, auto_assign_mode)
         VALUES (?, ?, ?, ?, ?)`,
        [teamId, context.userId, data.name, data.description, data.autoAssignMode],
      );
      return { ok: true, id: teamId };
    } catch (e: any) {
      console.error("Erro ao criar equipe:", e);
      throw new Error(e.message || "Erro ao criar equipe");
    }
  });

export const updateTeam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        description: z.string().trim().nullable(),
        autoAssignMode: z.enum(["manual", "round_robin", "least_busy"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      await db.query(
        `UPDATE teams 
         SET name = ?, description = ?, auto_assign_mode = ?
         WHERE id = ? AND user_id = ?`,
        [data.name, data.description, data.autoAssignMode, data.id, context.userId],
      );
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao atualizar equipe:", e);
      throw new Error(e.message || "Erro ao atualizar equipe");
    }
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await db.query("DELETE FROM teams WHERE id = ? AND user_id = ?", [data.id, context.userId]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao deletar equipe:", e);
      throw new Error(e.message || "Erro ao deletar equipe");
    }
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        teamId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(["agent", "supervisor"]).default("agent"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      // Validar se o time pertence ao tenant do usuário logado
      const team = await db.query("SELECT 1 FROM teams WHERE id = ? AND user_id = ?", [
        data.teamId,
        context.userId,
      ]);
      if (!team || team.length === 0) {
        throw new Error("Equipe não encontrada ou acesso negado.");
      }

      const memberId = crypto.randomUUID();
      await db.query(
        `INSERT INTO team_members (id, team_id, user_id, role)
         VALUES (?, ?, ?, ?)`,
        [memberId, data.teamId, data.userId, data.role],
      );
      return { ok: true, id: memberId };
    } catch (e: any) {
      console.error("Erro ao adicionar membro à equipe:", e);
      throw new Error(e.message || "Erro ao adicionar membro");
    }
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        teamId: z.string().min(1),
        userId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      // Validar se o time pertence ao tenant do usuário logado
      const team = await db.query("SELECT 1 FROM teams WHERE id = ? AND user_id = ?", [
        data.teamId,
        context.userId,
      ]);
      if (!team || team.length === 0) {
        throw new Error("Equipe não encontrada ou acesso negado.");
      }

      await db.query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [
        data.teamId,
        data.userId,
      ]);
      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao remover membro da equipe:", e);
      throw new Error(e.message || "Erro ao remover membro");
    }
  });
