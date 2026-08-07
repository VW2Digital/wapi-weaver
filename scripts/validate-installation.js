import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "wapi_weaver",
});

try {
  const schema = await fs.readFile("schema_mysql.sql", "utf8");
  const expectedTables = [
    ...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+`?([a-zA-Z0-9_]+)`?/gi),
  ].map((match) => match[1]);

  const [tableRows] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  const actualTables = new Set(tableRows.map((row) => row.TABLE_NAME));
  const missingTables = [...new Set(expectedTables)].filter((table) => !actualTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Tabelas ausentes: ${missingTables.join(", ")}`);
  }

  const [requiredColumns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (TABLE_NAME, COLUMN_NAME) IN (
         ('teams', 'tenant_id'),
         ('tags', 'tenant_id'),
         ('whatsapp_flows', 'flow_name')
       )`,
  );
  if (requiredColumns.length !== 3) {
    throw new Error("Colunas obrigatórias ausentes em teams, tags ou whatsapp_flows");
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const [admins] = await connection.query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     WHERE LOWER(u.email) = ? AND ur.role = 'admin_master'
     LIMIT 1`,
    [email],
  );

  if (admins.length !== 1) {
    throw new Error(`O usuário ${email || "informado"} não possui o papel admin_master.`);
  }

  console.log(
    `[Install validation] ${actualTables.size} tabelas encontradas; admin_master confirmado para ${email}.`,
  );
} catch (error) {
  console.error("[Install validation] Falha:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
