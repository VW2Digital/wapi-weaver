import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env if present
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
    console.error("[Capture Snapshot] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    const [[verRow]] = await connection.query("SELECT VERSION() AS ver");
    const mysqlVersion = verRow.ver;

    const [tablesRows] = await connection.query("SHOW TABLES");
    const tableNames = tablesRows.map(r => Object.values(r)[0]).sort();

    let outputSql = `-- LOCAL MYSQL HEAD SCHEMA SNAPSHOT\n`;
    outputSql += `-- Captured at: ${new Date().toISOString()}\n`;
    outputSql += `-- MySQL Version: ${mysqlVersion}\n`;
    outputSql += `-- Database: ${database}\n\n`;

    for (const tbl of tableNames) {
      const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${tbl}\``);
      outputSql += `${createRow["Create Table"]};\n\n`;
    }

    const outputDir = path.resolve(rootDir, ".tmp/schema-audit");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.resolve(outputDir, "local-head-schema.snapshot.sql");
    fs.writeFileSync(outputPath, outputSql, "utf8");

    const physicalCount = tableNames.length;
    const hasSchemaMigrations = tableNames.includes("schema_migrations");
    const functionalCount = tableNames.filter(t => t !== "schema_migrations").length;

    console.log("==================================================");
    console.log("LOCAL HEAD SNAPSHOT: PASS");
    console.log(`MYSQL VERSION: ${mysqlVersion}`);
    console.log(`DATABASE: ${database}`);
    console.log(`PHYSICAL TABLE COUNT: ${physicalCount}`);
    console.log(`FUNCTIONAL TABLE COUNT: ${functionalCount}`);
    console.log(`schema_migrations: ${hasSchemaMigrations ? "PRESENT" : "ABSENT"}`);
    console.log(`SNAPSHOT FILE: .tmp/schema-audit/local-head-schema.snapshot.sql`);
    console.log("==================================================");

  } catch (err) {
    console.error("[Capture Snapshot] ❌ FAIL:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
