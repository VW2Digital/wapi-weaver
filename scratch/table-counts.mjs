import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const tables = ["meta_app_connections", "channel_connections", "contacts", "contact_identities", "direct_messages", "chat_sessions", "opportunities", "messaging_events", "webhook_delivery_logs"];
for (const t of tables) {
  const [r] = await c.execute(`SELECT COUNT(*) AS c FROM ${t}`);
  console.log(`${t}: ${r[0].c}`);
}
await c.end();
