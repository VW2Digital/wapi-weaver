import mysql from "mysql2/promise";
import Redis from "ioredis";
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

const EXPECTED_TABLES = [
  "users",
  "profiles",
  "user_roles",
  "platform_settings",
  "license_settings",
  "licenses",
  "license_activations",
  "license_validation_logs",
  "contacts",
  "groups",
  "contact_groups",
  "custom_fields",
  "contact_custom_fields",
  "campaigns",
  "campaign_logs",
  "campaign_messages",
  "bot_flows",
  "bot_flow_executions",
  "bot_conversation_state",
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
  console.log("  VALIDATING INSTALLATION STATE & INTEGRITY     ");
  console.log("=================================================");

  // 1. Verify JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length === 0) {
    console.error("[Validation] ❌ FAIL: JWT_SECRET environment variable is missing or empty!");
    process.exit(1);
  }
  console.log("[Validation] ✅ SUCCESS: JWT_SECRET is configured.");

  // 2. MySQL Validation
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
  } catch (err) {
    console.error("[Validation] ❌ FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  try {
    // Fetch current tables
    const [tables] = await connection.query("SHOW TABLES");
    const existingTables = new Set(tables.map((t) => Object.values(t)[0]));

    const missingTables = EXPECTED_TABLES.filter((tbl) => !existingTables.has(tbl));

    if (missingTables.length > 0) {
      console.error(`[Validation] ❌ FAIL: Missing ${missingTables.length} required database table(s):`);
      missingTables.forEach((tbl) => console.error(`  - ${tbl}`));
      process.exit(1);
    }
    console.log(`[Validation] ✅ SUCCESS: All ${EXPECTED_TABLES.length} expected database tables verified.`);

    // Check critical columns
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
    }
    console.log("[Validation] ✅ SUCCESS: All critical columns verified.");

    // Check admin_master user
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
  } catch (err) {
    console.error("[Validation] ❌ FAIL: MySQL validation error:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }

  // 3. Redis Validation
  const redisHost = process.env.REDIS_HOST || "redis";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
  const redisPassword = process.env.REDIS_PASSWORD || "redis_pass";

  try {
    const redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });

    const pingRes = await redis.ping();
    await redis.quit();

    if (pingRes !== "PONG") {
      console.error(`[Validation] ❌ FAIL: Redis ping returned unexpected response: ${pingRes}`);
      process.exit(1);
    }
    console.log("[Validation] ✅ SUCCESS: Redis connection and ping verified.");
  } catch (redisErr) {
    console.error("[Validation] ❌ FAIL: Redis healthcheck failed:", redisErr.message);
    process.exit(1);
  }

  // 4. Application HTTP Authentication Healthcheck
  const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "adminmaster123";
  const appPort = process.env.PORT || 3000;
  const authUrl = `http://127.0.0.1:${appPort}/api/auth/login`;

  console.log(`[Validation] Performing HTTP POST authentication check against ${authUrl}...`);

  let authSuccess = false;
  let lastError = "";

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText}`;
      } else {
        const payload = await res.json();
        if (!payload.access_token) {
          lastError = `Response missing access_token: ${JSON.stringify(payload)}`;
        } else if (payload.user?.role !== "admin_master") {
          lastError = `Expected role 'admin_master', got '${payload.user?.role}'`;
        } else {
          authSuccess = true;
          console.log(`[Validation] ✅ SUCCESS: HTTP login authentication test PASSED for ${adminEmail} (attempt ${attempt}/30).`);
          break;
        }
      }
    } catch (authErr) {
      lastError = authErr.message || String(authErr);
    }

    console.log(`[Validation] Waiting for auth endpoint (${attempt}/30)... (${lastError})`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!authSuccess) {
    console.error(`[Validation] ❌ FAIL: Application HTTP auth check failed after 30 attempts: ${lastError}`);
    process.exit(1);
  }

  console.log("=================================================");
  console.log("  ALL CHECKS PASSED: Installation is 100% Valid  ");
  console.log("=================================================");
  process.exit(0);
}

main();
