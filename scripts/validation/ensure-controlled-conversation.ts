import { randomUUID } from "node:crypto";
import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";

const TENANT_ID = "6da65e93-4864-43c5-b17b-4c3864a49cfc";
const CHANNEL_CONNECTION_ID = "f4c277a7-3e71-408f-abc7-c4938e7a8727";
const CONTACT_PHONE = "5591985646076";
const CONTACT_NAME = "Controlled Step 12";

async function main() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error("Database not configured");
  }

  const sql = new RealMySqlExecutor({ host, port, user, password, database });

  const [channel] = await sql.execute<{ id: string }>(
    `SELECT id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp'`,
    [CHANNEL_CONNECTION_ID, TENANT_ID],
  );
  if (!channel) {
    throw new Error(`WhatsApp channel ${CHANNEL_CONNECTION_ID} not found for tenant ${TENANT_ID}`);
  }

  const existingSessions = await sql.execute<{ id: string }>(
    `SELECT cs.id FROM chat_sessions cs
     JOIN contacts c ON c.id = cs.contact_id
     WHERE cs.tenant_id = ? AND cs.channel_connection_id = ? AND c.phone_e164 = ?`,
    [TENANT_ID, CHANNEL_CONNECTION_ID, CONTACT_PHONE],
  );

  if (existingSessions.length > 0) {
    await sql.close();
    console.log(JSON.stringify({ conversationId: existingSessions[0].id, created: false }, null, 2));
    return;
  }

  const contactId = randomUUID();
  const sessionId = randomUUID();
  const identityId = randomUUID();
  const [firstUser] = await sql.execute<{ id: string }>(`SELECT id FROM users LIMIT 1`, []);
  const userId = firstUser?.id ?? randomUUID();

  await sql.execute(
    `INSERT INTO contacts
     (id, tenant_id, user_id, phone_e164, name, channel, external_id, source_type, status)
     VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, 'manual', 'active')`,
    [contactId, TENANT_ID, userId, CONTACT_PHONE, CONTACT_NAME, `wa:${CONTACT_PHONE}`],
  );

  await sql.execute(
    `INSERT INTO contact_identities
     (id, tenant_id, user_id, contact_id, provider, external_id, phone_e164)
     VALUES (?, ?, ?, ?, 'whatsapp', ?, ?)`,
    [identityId, TENANT_ID, userId, contactId, `wa:${CONTACT_PHONE}`, CONTACT_PHONE],
  );

  await sql.execute(
    `INSERT INTO chat_sessions
     (id, tenant_id, user_id, contact_id, channel_connection_id, status)
     VALUES (?, ?, ?, ?, ?, 'aguardando')`,
    [sessionId, TENANT_ID, userId, contactId, CHANNEL_CONNECTION_ID],
  );

  await sql.close();

  console.log(JSON.stringify({ conversationId: sessionId, created: true, contactId }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
