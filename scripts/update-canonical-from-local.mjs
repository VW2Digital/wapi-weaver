import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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
  console.log("==================================================");
  console.log("   UPDATING CANONICAL SCHEMA FROM LOCAL DATABASE   ");
  console.log("==================================================");

  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "wapi_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "wapi_weaver";

  if (!password) {
    console.error("[Update Schema] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    // 1. Get functional tables from database
    const [tablesRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [database]
    );

    const tableNames = tablesRows
      .map(r => r.TABLE_NAME)
      .filter(t => t !== "schema_migrations")
      .sort();

    console.log(`[Update Schema] Found ${tableNames.length} functional tables to export.`);

    // 2. Generate schema header
    let canonicalSql = `-- CANONICAL SCHEMA (SINGLE SOURCE OF TRUTH FOR WAPI WEAVER)\n`;
    canonicalSql += `-- Generated dynamically from local MySQL\n`;
    canonicalSql += `-- Date: ${new Date().toISOString()}\n\n`;
    canonicalSql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // 3. Dump SHOW CREATE TABLE for each table
    for (const tbl of tableNames) {
      const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${tbl}\``);
      let createSql = createRow["Create Table"];

      // Normalize CREATE TABLE to CREATE TABLE IF NOT EXISTS
      createSql = createSql.replace(/CREATE TABLE/i, "CREATE TABLE IF NOT EXISTS");

      // Remove specific auto_increment counters to avoid git changes pollution
      createSql = createSql.replace(/\s+AUTO_INCREMENT=\d+\b/gi, "");

      canonicalSql += `${createSql};\n\n`;
      console.log(`[Update Schema] Table '${tbl}' dumped.`);
    }

    // 4. Save canonical-schema.sql
    const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
    fs.writeFileSync(canonicalPath, canonicalSql, "utf8");
    console.log(`[Update Schema] ✅ Schema canonical saved to: database/schema/canonical-schema.sql`);

    // 5. Run contract generator to update json and reference sql files
    console.log("[Update Schema] Regenerating contract files...");
    execSync("node scripts/generate-schema-contract.js", { cwd: rootDir, stdio: "inherit" });
    console.log("[Update Schema] ✅ Contract files regenerated successfully.");

  } catch (err) {
    console.error("[Update Schema] ❌ FAIL:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
