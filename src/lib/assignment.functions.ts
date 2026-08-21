import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "./db";
import { resolveEffectiveUserId } from "./chat-helpers";
import crypto from "crypto";
import { assertUserCanJoinTenant } from "./tenant-authorization";
import { hasMasterRole } from "./roles";

const normalizeContactPhone = (value: string) => {
  if (
    value.startsWith("ig_") ||
    value.startsWith("fb_") ||
    value.endsWith("@g.us") ||
    value.endsWith("@temp")
  ) {
    return value;
  }

  return value.replace(/\D/g, "");
};

async function ensureTeamBelongsToWorkspace(teamId: string, effectiveUserId: string) {
  const rows = await db.query("SELECT id FROM teams WHERE id = ? AND tenant_id = ? LIMIT 1", [
    teamId,
    effectiveUserId,
  ]);

  if (!rows || rows.length === 0) {
    throw new Error("Equipe não encontrada ou acesso negado.");
  }
}

async function isPlatformMaster(userId: string) {
  const roleRows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    userId,
  ])) as Array<{ role: string }>;
  return hasMasterRole(roleRows.map(({ role }) => role));
}

async function ensureAgentBelongsToWorkspace(
  agentId: string,
  effectiveUserId: string,
  actorIsMaster: boolean,
) {
  if (agentId === effectiveUserId) return;

  const rows = await db.query(
    `SELECT 1
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE t.tenant_id = ? AND tm.user_id = ?
     LIMIT 1`,
    [effectiveUserId, agentId],
  );

  if (rows && rows.length > 0) return;

  if (actorIsMaster) {
    const platformUser = await db.query(
      `SELECT 1
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [agentId],
    );
    if (platformUser && platformUser.length > 0) return;
  }

  throw new Error("O agente informado não pertence a este workspace.");
}

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    try {
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const teams = await db.query(
        `SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
         FROM teams t 
         WHERE t.tenant_id = ?
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await ensureTeamBelongsToWorkspace(data.teamId, effectiveUserId);
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const isMaster = await isPlatformMaster(context.userId);
      const agents = await db.query(
        `SELECT DISTINCT u.id, p.full_name, p.display_name, u.email
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN team_members tm ON tm.user_id = u.id
         LEFT JOIN teams t ON t.id = tm.team_id
         WHERE (? = TRUE AND ur.user_id IS NOT NULL) OR u.id = ? OR t.tenant_id = ?
         ORDER BY COALESCE(p.full_name, p.display_name, u.email) ASC`,
        [isMaster, effectiveUserId, effectiveUserId],
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
      const phone = normalizeContactPhone(data.contactPhone);
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const actorIsMaster = await isPlatformMaster(context.userId);

      if (data.teamId) {
        await ensureTeamBelongsToWorkspace(data.teamId, effectiveUserId);
      }

      if (data.agentId) {
        await ensureAgentBelongsToWorkspace(data.agentId, effectiveUserId, actorIsMaster);
      }

      // 1. Validar associação do agente com a equipe se ambos forem informados
      if (data.teamId && data.agentId) {
        const members = await db.query(
          `SELECT 1
           FROM team_members tm
           JOIN teams t ON t.id = tm.team_id
           WHERE tm.team_id = ? AND tm.user_id = ? AND t.tenant_id = ?
           LIMIT 1`,
          [data.teamId, data.agentId, effectiveUserId],
        );
        if (!members || members.length === 0) {
          if (!actorIsMaster) {
            throw new Error("O agente informado não pertence a esta equipe.");
          }
          await db.query(
            `INSERT INTO team_members (id, team_id, user_id, role)
             VALUES (?, ?, ?, 'agent')
             ON DUPLICATE KEY UPDATE role = role`,
            [crypto.randomUUID(), data.teamId, data.agentId],
          );
        }
      }

      // 2. Marcar a atribuição ativa anterior como inativa
      await db.query(
        `UPDATE conversation_assignments 
         SET is_active = false, unassigned_at = CURRENT_TIMESTAMP()
         WHERE tenant_id = ? AND contact_phone = ? AND is_active = true`,
        [effectiveUserId, phone],
      );

      // 3. Criar nova atribuição ativa (se pelo menos uma equipe ou agente foi especificado)
      if (data.teamId || data.agentId) {
        const assignmentId = crypto.randomUUID();
        await db.query(
          `INSERT INTO conversation_assignments 
            (id, tenant_id, user_id, contact_phone, team_id, agent_id, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            assignmentId,
            effectiveUserId,
            effectiveUserId,
            phone,
            data.teamId,
            data.agentId,
            context.userId,
          ],
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
      const phone = normalizeContactPhone(data.contactPhone);
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await ensureTeamBelongsToWorkspace(data.teamId, effectiveUserId);

      // Run the full round-robin cycle inside a transaction to prevent race conditions
      // when multiple webhook messages arrive simultaneously.
      const result = await db.transaction(async (conn) => {
        // 1. SELECT the least-loaded agent with a locking read
        const [agents] = await conn.execute(
          `SELECT tm.user_id as agent_id, COUNT(ca.id) as active_chats
           FROM team_members tm
           LEFT JOIN conversation_assignments ca 
             ON ca.agent_id = tm.user_id AND ca.is_active = true AND ca.tenant_id = ?
           WHERE tm.team_id = ?
           GROUP BY tm.user_id
           ORDER BY active_chats ASC, RAND()
           LIMIT 1
           FOR UPDATE`,
          [effectiveUserId, data.teamId],
        );

        // 2. Deactivate previous assignment
        await conn.execute(
          `UPDATE conversation_assignments 
           SET is_active = false, unassigned_at = CURRENT_TIMESTAMP()
           WHERE tenant_id = ? AND contact_phone = ? AND is_active = true`,
          [effectiveUserId, phone],
        );

        const agentRows = agents as any[];
        const targetAgentId = agentRows && agentRows.length > 0 ? agentRows[0].agent_id : null;
        const assignmentId = crypto.randomUUID();

        // 3. Create the new assignment atomically
        await conn.execute(
          `INSERT INTO conversation_assignments 
            (id, tenant_id, user_id, contact_phone, team_id, agent_id, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            assignmentId,
            effectiveUserId,
            effectiveUserId,
            phone,
            data.teamId,
            targetAgentId,
            context.userId,
          ],
        );

        return { ok: true, agentId: targetAgentId };
      });

      return result;
    } catch (e: any) {
      console.error("Erro ao auto-atribuir conversa:", e);
      throw new Error(e.message || "Erro ao auto-atribuir conversa");
    }
  });

export const selfAssignConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ contactPhone: z.string().trim().min(5), teamId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const phone = normalizeContactPhone(data.contactPhone);
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await ensureTeamBelongsToWorkspace(data.teamId, effectiveUserId);

      // Verifica se o usuário atual é membro da equipe (administrador tem permissão bypass)
      const member = await db.query(
        `SELECT 1
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE tm.team_id = ? AND tm.user_id = ? AND t.tenant_id = ?
         LIMIT 1`,
        [data.teamId, context.userId, effectiveUserId],
      );
      const isAdmin = context.userId === effectiveUserId;
      if (!isAdmin && (!member || member.length === 0)) {
        throw new Error("Você não é membro desta equipe.");
      }

      // Desativa a atribuição anterior
      await db.query(
        `UPDATE conversation_assignments 
         SET is_active = false, unassigned_at = CURRENT_TIMESTAMP()
         WHERE tenant_id = ? AND contact_phone = ? AND is_active = true`,
        [effectiveUserId, phone],
      );

      // Cria nova atribuição com o próprio usuário como agente
      const assignmentId = crypto.randomUUID();
      await db.query(
        `INSERT INTO conversation_assignments 
          (id, tenant_id, user_id, contact_phone, team_id, agent_id, assigned_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          assignmentId,
          effectiveUserId,
          effectiveUserId,
          phone,
          data.teamId,
          context.userId,
          context.userId,
        ],
      );

      return { ok: true };
    } catch (e: any) {
      console.error("Erro ao auto-atribuir-se à conversa:", e);
      throw new Error(e.message || "Erro ao auto-atribuir-se à conversa");
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query(
        `INSERT INTO teams (id, tenant_id, user_id, name, description, auto_assign_mode)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          teamId,
          effectiveUserId,
          effectiveUserId,
          data.name,
          data.description,
          data.autoAssignMode,
        ],
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query(
        `UPDATE teams 
         SET name = ?, description = ?, auto_assign_mode = ?
         WHERE id = ? AND tenant_id = ?`,
        [data.name, data.description, data.autoAssignMode, data.id, effectiveUserId],
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      await db.query("DELETE FROM teams WHERE id = ? AND tenant_id = ?", [
        data.id,
        effectiveUserId,
      ]);
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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      // Validar se o time pertence ao tenant do usuário logado
      const team = await db.query("SELECT 1 FROM teams WHERE id = ? AND tenant_id = ?", [
        data.teamId,
        effectiveUserId,
      ]);
      if (!team || team.length === 0) {
        throw new Error("Equipe não encontrada ou acesso negado.");
      }

      await assertUserCanJoinTenant(data.userId, effectiveUserId);

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
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      // Validar se o time pertence ao tenant do usuário logado
      const team = await db.query("SELECT 1 FROM teams WHERE id = ? AND tenant_id = ?", [
        data.teamId,
        effectiveUserId,
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
