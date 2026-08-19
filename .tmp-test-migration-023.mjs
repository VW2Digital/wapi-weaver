import mysql from "mysql2/promise";
import fs from "node:fs";

const connection = await mysql.createConnection({
  host: "127.0.0.1",
  port: Number(process.env.CI_MYSQL_PORT),
  user: "root",
  password: "root_password",
  multipleStatements: true,
});
const database = "wapi_migration_023_test";
try {
  await connection.query(`DROP DATABASE IF EXISTS ${database}`);
  await connection.query(`CREATE DATABASE ${database}`);
  await connection.changeUser({ database });
  await connection.query(fs.readFileSync("database/migrations/001_canonical_schema.sql", "utf8"));
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  await connection.query(
    "INSERT INTO incoming_webhook_events (user_id, webhook_id, status, raw_payload) VALUES ('u', 'w', 'processing', '{}'), ('u', 'w', 'failed', '{}')",
  );
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  await connection.query(fs.readFileSync("database/migrations/023_webhook_events_catch_all.sql", "utf8"));
  const [rows] = await connection.query("SELECT status FROM incoming_webhook_events ORDER BY id");
  const [columns] = await connection.query("SHOW COLUMNS FROM incoming_webhook_events LIKE 'status'");
  console.log(JSON.stringify({ rows, type: columns[0].Type, default: columns[0].Default }));
} finally {
  await connection.changeUser({ database: undefined });
  await connection.query(`DROP DATABASE IF EXISTS ${database}`);
  await connection.end();
}
