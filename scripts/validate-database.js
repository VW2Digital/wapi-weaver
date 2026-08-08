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

const REQUIRED_TABLES = [
  "schema_migrations",
  "users",
  "profiles",
  "user_roles",
  "platform_settings",
  "license_settings",
  "licenses",
  "contacts",
  "templates",
  "campaigns",
  "campaign_messages",
  "bot_flows",
  "bot_steps",
  "direct_messages",
  "webhook_events",
];

const REQUIRED_COLUMNS = {
  profiles: [
    "whatsapp_verify_token",
    "whatsapp_access_token",
    "whatsapp_phone_number_id",
    "whatsapp_waba_id",
    "rate_limit_per_second",
  ],
  user_roles: ["role"],
  licenses: ["tenant_id", "status"],
  campaigns: ["message_type", "payload", "template_id", "started_at", "status"],
  campaign_messages: ["to_phone", "attempts", "failed_at", "error", "wa_message_id", "status"],
  webhook_events: ["processed", "received_at"],
};

async function main() {
  console.log("=================================================");
  console.log("  VALIDATING DATABASE SCHEMA & DATA INTEGRITY    ");
  console.log("=================================================");

  const dbConfig = {
    host: process.env.DB_HOST || "mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("[DB Validation] ✅ SUCCESS: Connected to MySQL database.");
  } catch (err) {
    console.error("[DB Validation] ❌ FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  try {
    // 1. Verify schema_migrations contains 001, 002, 003
    const [migrations] = await connection.query("SELECT version FROM schema_migrations");
    const migrationVersions = new Set(migrations.map((m) => m.version));
    const expectedMigrations = [
      "001_canonical_schema.sql",
      "002_fix_indexes_and_constraints.sql",
      "003_runtime_schema_alignment.sql",
    ];

    for (const mig of expectedMigrations) {
      if (!migrationVersions.has(mig)) {
        console.error(`[DB Validation] ❌ FAIL: Migration '${mig}' is missing in schema_migrations table!`);
        process.exit(1);
      }
    }
    console.log(`[DB Validation] ✅ SUCCESS: All ${expectedMigrations.length} migrations recorded in schema_migrations.`);

    // 2. Verify required tables
    const [tables] = await connection.query("SHOW TABLES");
    const existingTables = new Set(tables.map((t) => Object.values(t)[0]));
    const missingTables = REQUIRED_TABLES.filter((tbl) => !existingTables.has(tbl));

    if (missingTables.length > 0) {
      console.error(`[DB Validation] ❌ FAIL: Missing required table(s): ${missingTables.join(", ")}`);
      process.exit(1);
    }
    console.log(`[DB Validation] ✅ SUCCESS: All ${REQUIRED_TABLES.length} essential tables exist.`);

    // 3. Verify required columns
    let columnErrors = 0;
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      const [colRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const existingCols = new Set(colRows.map((c) => c.Field));

      for (const col of columns) {
        if (!existingCols.has(col)) {
          console.error(`[DB Validation] ❌ FAIL: Column '${col}' missing in table '${table}'.`);
          columnErrors++;
        }
      }
    }

    if (columnErrors > 0) {
      console.error(`[DB Validation] ❌ FAIL: Found ${columnErrors} missing required column(s).`);
      process.exit(1);
    }
    console.log("[DB Validation] ✅ SUCCESS: All required columns verified.");

    // 4. Verify admin user & roles
    const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
    const [adminRows] = await connection.query(
      `SELECT u.id, u.email, r.role 
       FROM users u 
       JOIN user_roles r ON u.id = r.user_id 
       WHERE LOWER(TRIM(u.email)) = ?`,
      [adminEmail],
    );

    if (adminRows.length === 0) {
      console.error(`[DB Validation] ❌ FAIL: Admin user '${adminEmail}' not found or missing user_roles record.`);
      process.exit(1);
    }

    const adminRole = adminRows[0].role;
    if (!["admin_master", "admin"].includes(adminRole)) {
      console.error(`[DB Validation] ❌ FAIL: Admin user '${adminEmail}' has invalid role '${adminRole}'.`);
      process.exit(1);
    }
    console.log(`[DB Validation] ✅ SUCCESS: Admin user '${adminEmail}' verified with role '${adminRole}'.`);

    // 5. Verify no invalid roles exist in user_roles
    const [invalidRoles] = await connection.query(
      `SELECT id, user_id, role FROM user_roles WHERE role NOT IN ('admin_master', 'admin', 'user')`,
    );

    if (invalidRoles.length > 0) {
      console.error(`[DB Validation] ❌ FAIL: Found ${invalidRoles.length} invalid role(s) in user_roles table.`);
      process.exit(1);
    }
    console.log("[DB Validation] ✅ SUCCESS: No invalid roles found in user_roles.");

    console.log("=================================================");
    console.log("  DATABASE VALIDATION PASSED SUCCESSFULLY        ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[DB Validation] ❌ FAIL: Database validation failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
