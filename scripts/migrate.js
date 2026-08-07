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

async function runMigrations() {
  console.log("[Migrate] Starting database migration runner...");

  const dbConfig = {
    host: process.env.DB_HOST || "mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
    multipleStatements: true,
  };

  let connection;
  let attempts = 0;
  while (attempts < 15) {
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log("[Migrate] Connected to MySQL database successfully.");
      break;
    } catch (err) {
      attempts++;
      console.log(`[Migrate] Waiting for MySQL connection (${attempts}/15)... Erro: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connection) {
    console.error("[Migrate] Critical: Could not connect to MySQL after 15 attempts.");
    process.exit(1);
  }

  try {
    // 1. Ensure tracking table schema_migrations exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Fetch applied migrations
    const [appliedRows] = await connection.query("SELECT version FROM schema_migrations");
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    // 2. Discover migration files
    const migrationsDir = path.resolve(__dirname, "../database/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("[Migrate] No database/migrations directory found. Skipping.");
      process.exit(0);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`[Migrate] Migration '${file}' already applied. Skipping.`);
        continue;
      }

      console.log(`[Migrate] Executing migration '${file}'...`);
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, "utf8");

      try {
        await connection.query(sqlContent);
        await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
        console.log(`[Migrate] Migration '${file}' applied successfully.`);
        appliedCount++;
      } catch (migrationErr) {
        console.error(`[Migrate] ERROR executing migration '${file}':`, migrationErr.message);
        throw migrationErr;
      }
    }

    console.log(`[Migrate] Migration runner completed successfully. ${appliedCount} migration(s) applied.`);
    process.exit(0);
  } catch (err) {
    console.error("[Migrate] Migration runner failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigrations();
