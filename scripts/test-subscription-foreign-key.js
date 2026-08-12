import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { validatePlanExistence, resolveValidPlanId, validateOrRejectPlan } from "../src/lib/plan-validator.js";

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
  console.log("==================================================");
  console.log("  TESTING SUBSCRIPTION PLAN FOREIGN KEY INTEGRITY ");
  console.log("==================================================");

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  const connection = await mysql.createConnection(dbConfig);
  console.log("✅ Connected to MySQL database.");

  try {
    // 1. Verify valid plan validation
    const validCheck = await validatePlanExistence("plan-mensal", connection);
    console.log("[Scenario 1 - Valid Plan Check]:", validCheck.exists ? "✅ PASS" : "⚠️ Plan plan-mensal not in DB");

    // 2. Verify invalid plan rejection & controlled response
    const invalidCheck = await validateOrRejectPlan("non_existent_plan_xyz", {
      userId: "test_user_123",
      tenantId: "test_tenant_123",
      operation: "unit_test_rejection",
    }, connection);

    if (!invalidCheck.valid && invalidCheck.response && invalidCheck.response.status === 400) {
      const body = await invalidCheck.response.json();
      if (body.success === false && body.message.includes("não está mais disponível")) {
        console.log("[Scenario 2 - Invalid Plan Rejection]: ✅ PASS (Returned controlled message: '" + body.message + "')");
      } else {
        console.error("[Scenario 2 - Invalid Plan Rejection]: ❌ FAIL (Unexpected body):", body);
      }
    } else {
      console.error("[Scenario 2 - Invalid Plan Rejection]: ❌ FAIL (Did not return 400 response)");
    }

    // 3. Verify plan resolution for non-existent / deleted plan_id
    const resolvedId = await resolveValidPlanId("deleted_old_plan_999", {
      userId: "legacy_user",
      tenantId: "legacy_tenant",
      operation: "unit_test_fallback",
    }, connection);

    if (resolvedId && resolvedId !== "deleted_old_plan_999") {
      console.log(`[Scenario 3 - Non-Existent Plan Fallback]: ✅ PASS (Resolved fallback active plan: '${resolvedId}')`);
    } else {
      console.error("[Scenario 3 - Non-Existent Plan Fallback]: ❌ FAIL (Did not resolve active fallback)");
    }

    // 4. Verify Database FK constraint on subscriptions table
    const [fkRows] = await connection.execute(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'plan_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
    );

    if (fkRows && fkRows.length > 0) {
      console.log(`[Scenario 4 - Foreign Key Check]: ✅ PASS (Foreign Key '${fkRows[0].CONSTRAINT_NAME}' points to '${fkRows[0].REFERENCED_TABLE_NAME}.${fkRows[0].REFERENCED_COLUMN_NAME}')`);
    } else {
      console.log("[Scenario 4 - Foreign Key Check]: ℹ️ No explicit FK constraint on subscriptions.plan_id in this DB instance.");
    }

    console.log("==================================================");
    console.log("  ALL SUBSCRIPTION PLAN TESTS COMPLETED!          ");
    console.log("==================================================");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
