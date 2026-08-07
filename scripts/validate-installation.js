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

const ESSENTIAL_TABLES = [
  "users",
  "profiles",
  "user_roles",
  "platform_settings",
  "licenses",
  "contacts",
  "campaigns",
  "bot_flows",
  "ds_agents",
  "custom_fields",
  "whatsapp_templates",
];

async function main() {
  console.log("[Validation] Validating installation state...");

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
    console.error("[Validation] Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  try {
    // 1. Check essential tables
    const [tables] = await connection.query("SHOW TABLES");
    const existingTableNames = tables.map((t) => Object.values(t)[0]);

    const missingTables = ESSENTIAL_TABLES.filter((tbl) => !existingTableNames.includes(tbl));
    if (missingTables.length > 0) {
      console.error(`[Validation] ERROR: Missing essential database tables: ${missingTables.join(", ")}`);
      process.exit(1);
    }
    console.log(`[Validation] All ${ESSENTIAL_TABLES.length} essential tables verified.`);

    // 2. Check admin_master user
    const [roles] = await connection.query(
      `SELECT u.email, r.role 
       FROM user_roles r 
       JOIN users u ON u.id = r.user_id 
       WHERE r.role = 'admin_master'`
    );

    if (roles.length === 0) {
      console.error("[Validation] ERROR: No user found with 'admin_master' role.");
      process.exit(1);
    }

    console.log(`[Validation] Verified ${roles.length} admin_master user(s): ${roles.map((r) => r.email).join(", ")}.`);
    console.log("[Validation] Installation validation PASSED successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[Validation] Error during validation:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
