import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [meta] = await c.execute("SELECT id, public_id, tenant_id, app_id, status FROM meta_app_connections");
const [chan] = await c.execute("SELECT id, tenant_id, meta_app_connection_id, provider, external_account_id, status, CASE WHEN access_token_encrypted IS NOT NULL AND access_token_encrypted != '' THEN 1 ELSE 0 END AS has_token FROM channel_connections");
console.log("META_APP_CONNECTIONS");
console.table(meta);
console.log("CHANNEL_CONNECTIONS");
console.table(chan);
await c.end();
