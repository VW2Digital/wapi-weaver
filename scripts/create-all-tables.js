import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractFinalTableDefinitions(sql) {
  const definitions = new Map();
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-zA-Z0-9_]+)`\s*\([\s\S]*?\)\s*ENGINE\s*=\s*[^;]+;/gi;

  for (const match of sql.matchAll(tableRegex)) {
    // Algumas tabelas possuem uma definição histórica seguida da definição
    // consolidada. A última ocorrência é o estado final usado pelo contrato.
    definitions.set(match[1], match[0]);
  }

  return definitions;
}

function extractIdempotentSeedStatements(sql) {
  return [...sql.matchAll(/INSERT\s+(?:IGNORE\s+)?INTO\s+[\s\S]*?;/gi)]
    .map((match) => match[0])
    .filter((statement) => /INSERT\s+IGNORE/i.test(statement) || /ON\s+DUPLICATE\s+KEY/i.test(statement));
}

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
    // 1. Read the DDL-only snapshot captured from the local MySQL head.
    // Unlike canonical-schema.sql, this file contains exactly one definition per table.
    const schemaPath = path.resolve(__dirname, "../database/schema/reference-schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.error(`[Create Tables] ❌ CRITICAL: Reference schema file not found at ${schemaPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(schemaPath, "utf8");
    const tableDefinitions = extractFinalTableDefinitions(sqlContent);
    if (tableDefinitions.size === 0) {
      throw new Error("Reference schema does not contain any CREATE TABLE definitions.");
    }

    console.log(
      `[Create Tables] Applying ${tableDefinitions.size} final canonical table definitions...`,
    );
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const [tableName, createSql] of tableDefinitions) {
        const idempotentCreateSql = createSql.replace(
          /CREATE\s+TABLE(?!\s+IF\s+NOT\s+EXISTS)/i,
          "CREATE TABLE IF NOT EXISTS",
        );
        await connection.query(idempotentCreateSql);
        console.log(`[Create Tables] Table '${tableName}' checked.`);
      }
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }
    console.log("[Create Tables] ✅ Final canonical table definitions applied successfully.");

    // reference-schema.sql intentionally excludes the migration bookkeeping
    // table because it is operational metadata, not part of the application
    // schema contract. Create it explicitly before registering the baseline.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[Create Tables] ✅ Migration tracking table 'schema_migrations' checked.");

    const canonicalSeedPath = path.resolve(__dirname, "../database/schema/canonical-schema.sql");
    const canonicalSeedSql = fs.existsSync(canonicalSeedPath)
      ? fs.readFileSync(canonicalSeedPath, "utf8")
      : "";
    const seedStatements = extractIdempotentSeedStatements(canonicalSeedSql);
    for (const seedSql of seedStatements) {
      await connection.query(seedSql);
    }
    console.log(`[Create Tables] ✅ ${seedStatements.length} idempotent seed statement(s) applied.`);

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
