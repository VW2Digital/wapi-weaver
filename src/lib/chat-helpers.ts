import db from "./db";

export async function resolveContactUserId(
  phone: string,
  currentUserId: string,
): Promise<string | null> {
  const rows: any[] = (await db.query(
    `SELECT user_id FROM contacts WHERE phone_e164 = ? LIMIT 1`,
    [phone],
  )) as any[];
  const contactUserId = rows?.[0]?.user_id;
  if (!contactUserId) return null;
  if (contactUserId === currentUserId) return contactUserId;
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
  const rows: any[] = (await db.query(
    `SELECT user_id, phone_e164 FROM contacts WHERE id = ? LIMIT 1`,
    [contactId],
  )) as any[];
  const contact = rows?.[0];
  if (!contact) return null;
  if (contact.user_id === currentUserId) return { userId: contact.user_id, phone: contact.phone_e164 };
  const assignments: any[] = (await db.query(
    `SELECT id FROM conversation_assignments
     WHERE contact_phone = ? AND agent_id = ? AND is_active = true LIMIT 1`,
    [contact.phone_e164, currentUserId],
  )) as any[];
  return assignments?.length ? { userId: contact.user_id, phone: contact.phone_e164 } : null;
}
