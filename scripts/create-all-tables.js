import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("    EXECUTING DATABASE INITIALIZATION SCHEMA     ");
  console.log("=================================================");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Create Tables] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: dbPassword,
    database: process.env.DB_NAME || "wapi_weaver",
    multipleStatements: true,
  };

  let connection;
  let attempts = 0;
  while (attempts < 15) {
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log(`[Create Tables] Connected to database '${dbConfig.database}' on ${dbConfig.host}:${dbConfig.port}`);
      break;
    } catch (err) {
      attempts++;
      console.log(`[Create Tables] Waiting for MySQL connection (${attempts}/15)... Erro: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connection) {
    console.error("[Create Tables] ❌ CRITICAL: Failed to connect to MySQL after 15 attempts.");
    process.exit(1);
  }

  try {
    // 1. Read Canonical Schema
    const schemaPath = path.resolve(__dirname, "../database/schema/canonical-schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.error(`[Create Tables] ❌ CRITICAL: Canonical schema file not found at ${schemaPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(schemaPath, "utf8");
    console.log("[Create Tables] Applying canonical database schema...");
    await connection.query(sqlContent);
    console.log("[Create Tables] ✅ Canonical schema SQL executed successfully.");

    // 2. Validate Required Tables
    const requiredTablesPath = path.resolve(__dirname, "../database/schema/required-tables.json");
    const requiredTables = JSON.parse(fs.readFileSync(requiredTablesPath, "utf8"));

    const [tableRows] = await connection.query("SHOW TABLES");
    const existingTables = new Set(tableRows.map((t) => Object.values(t)[0]));

    const missingTables = requiredTables.filter((tbl) => !existingTables.has(tbl));

    if (missingTables.length > 0) {
      console.error("\nDATABASE BOOTSTRAP FAILED");
      console.error("\nMissing tables:");
      missingTables.forEach((tbl) => console.error(`- ${tbl}`));
      process.exit(1);
    }

    console.log(`[Create Tables] ✅ SUCCESS: Verified all ${requiredTables.length} essential tables exist in database.`);

    // 3. Register ALL baseline migrations in schema_migrations
    // schema_migrations is already created by canonical-schema.sql itself
    // Read canonical-baseline.json to get the full list of migrations already incorporated
    const baselinePath = path.resolve(__dirname, "../database/schema/canonical-baseline.json");
    if (!fs.existsSync(baselinePath)) {
      console.error(`[Create Tables] ❌ CRITICAL: canonical-baseline.json not found at ${baselinePath}`);
      process.exit(1);
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const migrations = baseline.includedMigrations || [];

    console.log(`[Create Tables] Registering ${migrations.length} baseline migrations in schema_migrations...`);
    for (const migration of migrations) {
      await connection.query(
        "INSERT IGNORE INTO schema_migrations (version) VALUES (?)",
        [migration]
      );
    }
    console.log(`[Create Tables] ✅ Baseline registered: migrations up to '${baseline.canonicalVersion}' marked as applied.`);

    console.log("=================================================");
    console.log("   DATABASE SCHEMA CREATION PASSED SUCCESSFULLY  ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[Create Tables] ❌ CRITICAL: Schema creation failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();


