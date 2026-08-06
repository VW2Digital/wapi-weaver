"use server";
import db from "./db";

export async function resolveEffectiveUserId(currentUserId: string): Promise<string> {
  const rows: any[] = (await db.query(
    `SELECT DISTINCT t.user_id FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ?
     LIMIT 2`,
    [currentUserId],
  )) as any[];
  if (rows.length > 1) {
    console.warn("[Tenant Isolation] Usuário vinculado a mais de um tenant", {
      userId: currentUserId,
      tenantIds: rows.map((row) => row.user_id),
    });
  }
  return rows?.[0]?.user_id ?? currentUserId;
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
