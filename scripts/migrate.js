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

async function ensureColumnExists(connection, tableName, columnName, columnDefinition) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  if (rows.length === 0) {
    console.log(`[Migrate] Adding missing column '${columnName}' to table '${tableName}'...`);
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
  }
}

async function ensureRuntimeSchemaAlignment(connection) {
  await ensureColumnExists(connection, "contacts", "phone_e164", "VARCHAR(50) NULL");
  await ensureColumnExists(connection, "contacts", "opted_out", "BOOLEAN NOT NULL DEFAULT false");
  await ensureColumnExists(connection, "contacts", "channel", "VARCHAR(50) NOT NULL DEFAULT 'whatsapp'");
  await ensureColumnExists(connection, "contacts", "custom_fields", "JSON NULL");

  await ensureColumnExists(connection, "campaigns", "message_type", "VARCHAR(50) NOT NULL DEFAULT 'text'");
  await ensureColumnExists(connection, "campaigns", "template_id", "VARCHAR(36) NULL");
  await ensureColumnExists(connection, "campaigns", "list_id", "VARCHAR(36) NULL");
  await ensureColumnExists(connection, "campaigns", "payload", "JSON NULL");
  await ensureColumnExists(connection, "campaigns", "started_at", "DATETIME NULL");
  await ensureColumnExists(connection, "campaigns", "finished_at", "DATETIME NULL");
  await ensureColumnExists(connection, "campaigns", "totals", "JSON NULL");

  await ensureColumnExists(connection, "campaign_messages", "to_phone", "VARCHAR(50) NULL");
  await ensureColumnExists(connection, "campaign_messages", "attempts", "INT NOT NULL DEFAULT 0");
  await ensureColumnExists(connection, "campaign_messages", "error", "JSON NULL");
  await ensureColumnExists(connection, "campaign_messages", "wa_message_id", "VARCHAR(255) NULL");
  await ensureColumnExists(connection, "campaign_messages", "failed_at", "DATETIME NULL");

  await ensureColumnExists(connection, "webhook_events", "processed", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumnExists(connection, "webhook_events", "received_at", "DATETIME NULL");
  await ensureColumnExists(connection, "webhook_events", "tenant_id", "VARCHAR(36) NULL");
  await ensureColumnExists(connection, "webhook_events", "event_type", "VARCHAR(100) NULL");
  await ensureColumnExists(connection, "webhook_events", "payload_json", "JSON NULL");
  await ensureColumnExists(connection, "webhook_events", "status", "VARCHAR(50) NULL");
  await ensureColumnExists(connection, "webhook_events", "error_message", "TEXT NULL");
  await ensureColumnExists(connection, "webhook_events", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

  await ensureColumnExists(connection, "licenses", "tenant_id", "VARCHAR(36) NULL UNIQUE");

  // Subscriptions & Billing
  await ensureColumnExists(connection, "subscriptions", "current_period_start", "DATETIME NULL");
  await ensureColumnExists(connection, "subscriptions", "current_period_end", "DATETIME NULL");
  await ensureColumnExists(connection, "subscriptions", "trial_started_at", "DATETIME NULL");
  await ensureColumnExists(connection, "subscriptions", "trial_ends_at", "DATETIME NULL");
  await ensureColumnExists(connection, "subscriptions", "trial_consumed_at", "DATETIME NULL");
  await ensureColumnExists(connection, "subscriptions", "activated_at", "DATETIME NULL");

  await ensureColumnExists(connection, "subscription_events", "source", "VARCHAR(50) NULL");
  await ensureColumnExists(connection, "subscription_events", "gateway_event_id", "VARCHAR(255) NULL");
  await ensureColumnExists(connection, "subscription_events", "payload_json", "JSON NULL");
  await ensureColumnExists(connection, "subscription_events", "raw_payload", "TEXT NULL");

  await ensureColumnExists(connection, "billing_payments", "qr_code", "TEXT NULL");
  await ensureColumnExists(connection, "billing_payments", "qr_code_base64", "LONGTEXT NULL");
  await ensureColumnExists(connection, "billing_payments", "ticket_url", "TEXT NULL");
  await ensureColumnExists(connection, "billing_payments", "payload_json", "JSON NULL");

  await ensureColumnExists(connection, "billing_webhook_events", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

  await ensureColumnExists(connection, "billing_plans", "billing_cycle", "VARCHAR(20) NOT NULL DEFAULT 'monthly'");
  await ensureColumnExists(connection, "billing_plans", "price_cents", "INT NOT NULL DEFAULT 0");
  await ensureColumnExists(connection, "billing_plans", "currency", "VARCHAR(10) NOT NULL DEFAULT 'BRL'");
  await ensureColumnExists(connection, "billing_plans", "trial_days", "INT NOT NULL DEFAULT 0");
  await ensureColumnExists(connection, "billing_plans", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumnExists(connection, "billing_plans", "sort_order", "INT NOT NULL DEFAULT 0");
  await ensureColumnExists(connection, "billing_plans", "features_json", "JSON NULL");

  // DS Agent
  await ensureColumnExists(connection, "ds_agents", "prompt", "TEXT NULL");
  await ensureColumnExists(connection, "ds_agents", "is_active", "TINYINT(1) NOT NULL DEFAULT 1");

  await ensureColumnExists(connection, "ds_agent_tools", "tool_key", "VARCHAR(100) NOT NULL DEFAULT 'tool'");
  await ensureColumnExists(connection, "ds_agent_tools", "enabled", "TINYINT(1) NOT NULL DEFAULT 1");
  await ensureColumnExists(connection, "ds_agent_tools", "config", "JSON NULL");
}

async function runMigrations() {
  console.log("[Migrate] Starting database migration runner...");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Migrate] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
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

    // Alinhamento condicional de colunas via information_schema
    await ensureRuntimeSchemaAlignment(connection);

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
