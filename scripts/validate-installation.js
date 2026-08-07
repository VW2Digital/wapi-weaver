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

// Complete list of expected database tables
const EXPECTED_TABLES = [
  "users",
  "profiles",
  "user_roles",
  "platform_settings",
  "license_settings",
  "licenses",
  "contacts",
  "groups",
  "contact_groups",
  "custom_fields",
  "contact_custom_fields",
  "campaigns",
  "campaign_logs",
  "bot_flows",
  "bot_flow_executions",
  "ds_agent_folders",
  "ds_agents",
  "ds_agent_documents",
  "chat_sessions",
  "direct_messages",
  "conversation_tags",
  "whatsapp_templates",
  "subscription_plans",
  "subscription_events",
  "subscription_plan_changes",
  "tenant_storage",
  "audit_logs",
  "webhook_events",
  "platform_banners",
];

// Critical columns that must exist in specific tables
const CRITICAL_COLUMNS = {
  profiles: [
    "whatsapp_verify_token",
    "whatsapp_access_token",
    "whatsapp_phone_number_id",
    "whatsapp_waba_id",
    "rate_limit_per_second",
  ],
  user_roles: ["role"],
  licenses: ["tenant_id", "status"],
  direct_messages: ["wa_message_id", "status"],
};

async function main() {
  console.log("=================================================");
  console.log("  VALIDATING DATABASE STRUCTURE & PERMISSIONS  ");
  console.log("=================================================");

  const dbConfig = {
    host: process.env.DB_HOST || "banco-mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error("[Validation] FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  try {
    // 1. Fetch current tables in database
    const [tables] = await connection.query("SHOW TABLES");
    const existingTables = new Set(tables.map((t) => Object.values(t)[0]));

    console.log(`[Validation] Total tables found in DB '${dbConfig.database}': ${existingTables.size}`);

    const missingTables = EXPECTED_TABLES.filter((tbl) => !existingTables.has(tbl));

    if (missingTables.length > 0) {
      console.error(`[Validation] ❌ FAIL: The following ${missingTables.length} table(s) are missing:`);
      missingTables.forEach((tbl) => console.error(`  - ${tbl}`));
      process.exit(1);
    } else {
      console.log(`[Validation] ✅ SUCCESS: All ${EXPECTED_TABLES.length} expected tables exist.`);
    }

    // 2. Check critical columns
    let columnErrors = 0;
    for (const [table, columns] of Object.entries(CRITICAL_COLUMNS)) {
      const [colRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const existingCols = new Set(colRows.map((c) => c.Field));

      for (const col of columns) {
        if (!existingCols.has(col)) {
          console.error(`[Validation] ❌ FAIL: Missing column '${col}' in table '${table}'.`);
          columnErrors++;
        }
      }
    }

    if (columnErrors > 0) {
      console.error(`[Validation] ❌ FAIL: Found ${columnErrors} missing critical column(s).`);
      process.exit(1);
    } else {
      console.log("[Validation] ✅ SUCCESS: All critical columns verified.");
    }

    // 3. Check admin_master user
    const [roles] = await connection.query(
      `SELECT u.email, r.role 
       FROM user_roles r 
       JOIN users u ON u.id = r.user_id 
       WHERE r.role = 'admin_master'`
    );

    if (roles.length === 0) {
      console.error("[Validation] ❌ FAIL: No user found with 'admin_master' role.");
      process.exit(1);
    }

    console.log(`[Validation] ✅ SUCCESS: Verified ${roles.length} admin_master user(s): ${roles.map((r) => r.email).join(", ")}`);
    console.log("=================================================");
    console.log("  ALL CHECKS PASSED: Installation is 100% Valid  ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[Validation] ❌ FAIL: Exception during validation:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
