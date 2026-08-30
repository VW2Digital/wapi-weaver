import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";

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
  const tenantId = "6da65e93-4864-43c5-b17b-4c3864a49cfc";
  const channelConnectionId = "f4c277a7-3e71-408f-abc7-c4938e7a8727";

  const sessions = await sql.execute<{ id: string; contact_id: string }>(
    `SELECT id, contact_id FROM chat_sessions WHERE tenant_id = ? AND channel_connection_id = ?`,
    [tenantId, channelConnectionId],
  );

  const users = await sql.execute<{ id: string; email: string }>(
    `SELECT id, email FROM users LIMIT 1`,
    [],
  );

  const conversationColumns = await sql.execute<{ Field: string; Type: string }>(
    `SHOW COLUMNS FROM chat_sessions`,
    [],
  );

  const identityColumns = await sql.execute<{ Field: string; Type: string }>(
    `SHOW COLUMNS FROM contact_identities`,
    [],
  );

  const contactsColumns = await sql.execute<{ Field: string; Type: string }>(
    `SHOW COLUMNS FROM contacts`,
    [],
  );

  await sql.close();

  console.log(JSON.stringify({ sessions, users, conversationColumns, identityColumns, contactsColumns }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
