import db from "./db";
import { hasCompanyAdminRole, hasMasterRole } from "./roles";
import { setResponseStatus } from "@tanstack/react-start/server";

export type TenantResource = "bot_flow" | "bot_step" | "lost_reason" | "team";

const RESOURCE_SCOPE: Record<
  TenantResource,
  { table: string; tenantColumn: "tenant_id" | "user_id" }
> = {
  bot_flow: { table: "bot_flows", tenantColumn: "tenant_id" },
  bot_step: { table: "bot_steps", tenantColumn: "tenant_id" },
  lost_reason: { table: "opportunity_lost_reasons", tenantColumn: "tenant_id" },
  team: { table: "teams", tenantColumn: "tenant_id" },
};

function deny(message: string, statusCode: 403 | 404): never {
  setResponseStatus(statusCode);
  throw Object.assign(new Error(message), { statusCode });
}

export async function getActorTenantAccess(userId: string, tenantId: string) {
  const rows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    userId,
  ])) as Array<{
    role: string;
  }>;
  const roles = rows.map(({ role }) => role);
  const isOwner = Boolean(userId && tenantId && userId === tenantId);
  return {
    tenantId,
    isMaster: hasMasterRole(roles),
    isCompanyAdmin: isOwner || hasCompanyAdminRole(roles),
  };
}

export async function getUserTenantIds(userId: string): Promise<string[]> {
  const rows = (await db.query(
    `SELECT DISTINCT tenant_id
     FROM (
       SELECT ur.user_id AS tenant_id
       FROM user_roles ur
       WHERE ur.user_id = ? AND ur.role IN ('admin', 'admin_master')
       UNION
       SELECT t.tenant_id AS tenant_id
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ?
     ) memberships`,
    [userId, userId],
  )) as Array<{ tenant_id: string }>;
  return rows.map(({ tenant_id }) => tenant_id);
}

export async function assertUserBelongsToTenant(userId: string, tenantId: string): Promise<void> {
  if (userId === tenantId) return;
  const tenantIds = await getUserTenantIds(userId);
  if (!tenantIds.includes(tenantId)) {
    deny("Usuário não encontrado ou acesso negado.", 403);
  }
}

export async function assertUserCanJoinTenant(userId: string, tenantId: string): Promise<void> {
  const users = (await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [
    userId,
  ])) as unknown[];
  if (users.length === 0) {
    deny("Usuário não encontrado.", 404);
  }

  const tenantIds = await getUserTenantIds(userId);
  if (tenantIds.length > 0 && !tenantIds.includes(tenantId)) {
    deny("O usuário já pertence a outra empresa.", 403);
  }
}

export async function assertBelongsToTenant(
  resourceId: string,
  resource: TenantResource,
  tenantId: string,
): Promise<void> {
  const scope = RESOURCE_SCOPE[resource];
  const querySql = `SELECT id FROM ${scope.table} WHERE id = ? AND ${scope.tenantColumn} = ? LIMIT 1`;
  const rows = (await db.query(querySql, [resourceId, tenantId])) as unknown[];
  if (rows.length === 0) {
    deny("Recurso não encontrado ou acesso negado.", 403);
  }
}

export async function listTenantUserIds(tenantId: string): Promise<string[]> {
  const rows = (await db.query(
    `SELECT DISTINCT u.id
     FROM users u
     LEFT JOIN team_members tm ON tm.user_id = u.id
     LEFT JOIN teams t ON t.id = tm.team_id AND t.tenant_id = ?
     WHERE u.id = ? OR t.tenant_id = ?`,
    [tenantId, tenantId, tenantId],
  )) as Array<{ id: string }>;
  return rows.map(({ id }) => id);
}
