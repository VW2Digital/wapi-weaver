import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env
const dotenvPath = path.resolve(rootDir, ".env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const eqIdx = trimmed.indexOf("=");
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "wapi_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "wapi_weaver";

  if (!password) {
    console.error("DB_PASSWORD missing.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    const migPath = path.resolve(rootDir, "database/migrations/012_reconcile_full_schema_with_local.sql");
    const sql = fs.readFileSync(migPath, "utf8");
    console.log("Executing 012_reconcile_full_schema_with_local.sql...");
    await connection.query(sql);
    console.log("012 migration executed successfully!");
  } catch (err) {
    console.error("Failed to execute 012:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
