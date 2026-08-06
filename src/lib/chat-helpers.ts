"use server";
import db from "./db";

import { hasMasterRole } from "./roles";

export async function resolveEffectiveUserId(currentUserId: string): Promise<string> {
  const rows: any[] = (await db.query(
    `SELECT DISTINCT t.tenant_id FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ?
     LIMIT 2`,
    [currentUserId],
  )) as any[];
  if (rows.length > 1) {
    console.warn("[Tenant Isolation] Usuário vinculado a mais de um tenant", {
      userId: currentUserId,
      tenantIds: rows.map((row) => row.tenant_id),
    });
  }
  return rows?.[0]?.tenant_id ?? currentUserId;
}

export async function getTenantFilter(currentUserId: string, tablePrefix: string = ""): Promise<{ isMaster: boolean; effectiveTenantId: string; sqlWhere: string; params: any[] }> {
  const rolesRows = (await db.query(
    `SELECT role FROM user_roles WHERE user_id = ?`,
    [currentUserId],
  )) as Array<{ role: string }>;

  const roles = rolesRows.map((r) => r.role);
  const isMasterUser = hasMasterRole(roles);

  if (isMasterUser) {
    return { isMaster: true, effectiveTenantId: currentUserId, sqlWhere: "1=1", params: [] };
  }

  const effectiveTenantId = await resolveEffectiveUserId(currentUserId);
  const prefix = tablePrefix ? `\`${tablePrefix}\`.` : "";
  return { isMaster: false, effectiveTenantId, sqlWhere: `${prefix}\`tenant_id\` = ?`, params: [effectiveTenantId] };
}

export async function resolveContactUserId(
  phone: string,
  currentUserId: string,
): Promise<string | null> {
  const effectiveUserId = await resolveEffectiveUserId(currentUserId);
  const rows: any[] = (await db.query(
    `SELECT user_id FROM contacts WHERE phone_e164 = ? AND user_id = ? LIMIT 1`,
    [phone, effectiveUserId],
  )) as any[];
  const contactUserId = rows?.[0]?.user_id;
  if (!contactUserId) return null;
  if (currentUserId === effectiveUserId) return contactUserId;
  const assignments: any[] = (await db.query(
    `SELECT id FROM conversation_assignments
     WHERE contact_phone = ? AND agent_id = ? AND is_active = true LIMIT 1`,
    [phone, currentUserId],
  )) as any[];
  return assignments?.length ? contactUserId : null;
}

export async function resolveContactUserIdById(
  contactId: string,
  currentUserId: string,
): Promise<{ userId: string; phone: string } | null> {
  const effectiveUserId = await resolveEffectiveUserId(currentUserId);
  const rows: any[] = (await db.query(
    `SELECT user_id, phone_e164 FROM contacts WHERE id = ? AND user_id = ? LIMIT 1`,
    [contactId, effectiveUserId],
  )) as any[];
  const contact = rows?.[0];
  if (!contact) return null;
  if (currentUserId === effectiveUserId)
    return { userId: contact.user_id, phone: contact.phone_e164 };
  const assignments: any[] = (await db.query(
    `SELECT id FROM conversation_assignments
     WHERE contact_phone = ? AND agent_id = ? AND is_active = true LIMIT 1`,
    [contact.phone_e164, currentUserId],
  )) as any[];
  return assignments?.length ? { userId: contact.user_id, phone: contact.phone_e164 } : null;
}
