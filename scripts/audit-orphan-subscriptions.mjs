import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
  console.log("  AUDIT QUERY: ORPHAN SUBSCRIPTIONS (INVALID PLAN_ID) ");
  console.log("==================================================");

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error("❌ Connection error:", err.message);
    process.exit(1);
  }

  try {
    const [orphanRows] = await connection.execute(`
      SELECT s.id AS subscription_id, s.tenant_id, s.customer_id, s.plan_id, s.status, s.updated_at
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN billing_plans bp ON s.plan_id = bp.id
      WHERE sp.id IS NULL AND bp.id IS NULL
    `) ;

    console.log(`ORPHAN SUBSCRIPTIONS FOUND: ${orphanRows.length}`);

    if (orphanRows.length === 0) {
      console.log("✅ AUDIT PASS: 0 subscriptions with orphan or invalid plan_id.");
    } else {
      console.error("❌ AUDIT FAIL: Found subscriptions with invalid plan_id:");
      console.table(orphanRows);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
