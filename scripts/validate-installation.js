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
  const expectedSchema = new Map();
  const createTablePattern =
    /CREATE TABLE(?: IF NOT EXISTS)?\s+`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi;

  for (const match of schema.matchAll(createTablePattern)) {
    const columns = new Set();
    for (const line of match[2].split(/\r?\n/)) {
      const column = line.match(/^\s*`([^`]+)`\s+/);
      if (column) columns.add(column[1]);
    }
    expectedSchema.set(match[1], columns);
  }

  if (expectedSchema.size === 0) {
    throw new Error("Não foi possível interpretar as tabelas do schema_mysql.sql");
  }

  const [tableRows] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  const actualTables = new Set(tableRows.map((row) => row.TABLE_NAME));
  const missingTables = [...expectedSchema.keys()].filter((table) => !actualTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Tabelas ausentes: ${missingTables.join(", ")}`);
  }

  const [columnRows] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()`,
  );

  const actualColumns = new Map();
  for (const row of columnRows) {
    if (!actualColumns.has(row.TABLE_NAME)) actualColumns.set(row.TABLE_NAME, new Set());
    actualColumns.get(row.TABLE_NAME).add(row.COLUMN_NAME);
  }

  const missingColumns = [];
  for (const [table, expectedColumns] of expectedSchema) {
    const tableColumns = actualColumns.get(table) || new Set();
    for (const column of expectedColumns) {
      if (!tableColumns.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(`Colunas ausentes: ${missingColumns.join(", ")}`);
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
    `[Install validation] ${expectedSchema.size} tabelas e ${columnRows.length} colunas verificadas; admin_master confirmado para ${email}.`,
  );
} catch (error) {
  console.error("[Install validation] Falha:", error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
