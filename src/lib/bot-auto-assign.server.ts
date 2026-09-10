/**
 * Auto-atribuição UMA VEZ por contato (doc §7).
 * Prioridade: time/usuário da etapa (quando passado) → time round-robin da conta → dono.
 * Instância com time fixo: usa colunas opcionais em channel_connections se existirem.
 */
import crypto from "crypto";

export async function processAutoAssignOnce(params: {
  tenantId: string;
  contactPhone: string;
  phoneNumberId?: string | null;
  /** Override vindo de sentinel/botão */
  teamId?: string | null;
  agentId?: string | null;
}): Promise<{ assigned: boolean; reason: string; agentId?: string | null }> {
  const phone = String(params.contactPhone || "").replace(/\D/g, "");
  if (!phone || !params.tenantId) {
    return { assigned: false, reason: "INVALID_INPUT" };
  }

  const { default: db } = await import("./db");

  const existing = (await db.query(
    `SELECT id, agent_id, team_id FROM conversation_assignments
     WHERE tenant_id = ? AND contact_phone = ? AND is_active = 1
     LIMIT 1`,
    [params.tenantId, phone],
  )) as Array<{ id: string; agent_id: string | null; team_id: string | null }>;

  if (existing?.[0]) {
    return {
      assigned: false,
      reason: "ALREADY_ASSIGNED",
      agentId: existing[0].agent_id,
    };
  }

  let teamId = params.teamId || null;
  let agentId = params.agentId || null;

  // 1) Time/usuário fixo da conexão (colunas opcionais)
  if (!teamId && !agentId && params.phoneNumberId) {
    try {
      const cols = (await db.query(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'channel_connections'
           AND COLUMN_NAME IN ('default_team_id', 'default_agent_id', 'fixed_user_id')`,
      )) as Array<{ name: string }>;
      const names = new Set(cols.map((c) => c.name));
      if (names.size > 0) {
        const selectParts = [
          names.has("default_team_id") ? "default_team_id" : "NULL AS default_team_id",
          names.has("default_agent_id")
            ? "default_agent_id"
            : names.has("fixed_user_id")
              ? "fixed_user_id AS default_agent_id"
              : "NULL AS default_agent_id",
        ];
        const rows = (await db.query(
          `SELECT ${selectParts.join(", ")}
           FROM channel_connections
           WHERE tenant_id = ?
             AND (external_account_id = ? OR id = ?)
           ORDER BY (status = 'active') DESC
           LIMIT 1`,
          [params.tenantId, params.phoneNumberId, params.phoneNumberId],
        )) as Array<{ default_team_id?: string | null; default_agent_id?: string | null }>;
        if (rows?.[0]) {
          teamId = rows[0].default_team_id || null;
          agentId = rows[0].default_agent_id || null;
        }
      }
    } catch {
      /* optional schema */
    }
  }

  // 2) Time da conta com round_robin / least_busy
  if (!teamId && !agentId) {
    try {
      const teams = (await db.query(
        `SELECT id FROM teams
         WHERE tenant_id = ? AND auto_assign_mode IN ('round_robin', 'least_busy')
         ORDER BY created_at ASC
         LIMIT 1`,
        [params.tenantId],
      )) as Array<{ id: string }>;
      if (teams?.[0]?.id) teamId = teams[0].id;
    } catch {
      /* optional */
    }
  }

  // 3) Nada configurado → dono da conexão (tenant)
  if (!teamId && !agentId) {
    agentId = params.tenantId;
  }

  try {
    const result = await db.transaction(async (conn: any) => {
      // Re-check inside lock
      const [again] = await conn.execute(
        `SELECT id FROM conversation_assignments
         WHERE tenant_id = ? AND contact_phone = ? AND is_active = 1
         LIMIT 1
         FOR UPDATE`,
        [params.tenantId, phone],
      );
      if ((again as any[])?.length) {
        return { assigned: false as const, reason: "ALREADY_ASSIGNED" };
      }

      let finalAgentId = agentId;
      if (teamId && !finalAgentId) {
        const [agents] = await conn.execute(
          `SELECT tm.user_id AS agent_id, COUNT(ca.id) AS active_chats
           FROM team_members tm
           LEFT JOIN conversation_assignments ca
             ON ca.agent_id = tm.user_id AND ca.is_active = true AND ca.tenant_id = ?
           WHERE tm.team_id = ?
           GROUP BY tm.user_id
           ORDER BY active_chats ASC, RAND()
           LIMIT 1
           FOR UPDATE`,
          [params.tenantId, teamId],
        );
        const agentRows = agents as Array<{ agent_id: string }>;
        if (agentRows?.[0]?.agent_id) finalAgentId = agentRows[0].agent_id;
      }

      const assignmentId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO conversation_assignments
          (id, tenant_id, user_id, contact_phone, team_id, agent_id, assigned_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          assignmentId,
          params.tenantId,
          params.tenantId,
          phone,
          teamId,
          finalAgentId || null,
          null,
        ],
      );

      // Transfere responsável do contato quando possível
      try {
        await conn.execute(
          `UPDATE contacts
           SET responsible_user_id = COALESCE(?, responsible_user_id)
           WHERE tenant_id = ?
             AND (phone_e164 = ? OR whatsapp_number = ? OR REPLACE(REPLACE(REPLACE(phone_e164,'+',''),'-',''),' ','') = ?)`,
          [finalAgentId || null, params.tenantId, phone, phone, phone],
        );
      } catch {
        /* optional column */
      }

      return { assigned: true as const, reason: "ASSIGNED", agentId: finalAgentId };
    });

    return result;
  } catch (err: any) {
    console.error("[auto-assign] Falha:", err?.message);
    return { assigned: false, reason: "ERROR" };
  }
}
