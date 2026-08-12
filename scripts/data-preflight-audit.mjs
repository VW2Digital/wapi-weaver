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
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "wapi_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "wapi_weaver";

  if (!password) {
    console.error("[Data Preflight] ❌ CRITICAL: DB_PASSWORD missing.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    const [[{ count: whTotal }]] = await connection.query("SELECT COUNT(*) AS count FROM webhook_events");
    const [[{ count: whEventTypeNull }]] = await connection.query("SELECT COUNT(*) AS count FROM webhook_events WHERE event_type IS NULL");
    const [[{ count: whStatusNull }]] = await connection.query("SELECT COUNT(*) AS count FROM webhook_events WHERE status IS NULL");

    const [[{ count: toolTotal }]] = await connection.query("SELECT COUNT(*) AS count FROM ds_agent_tools");
    const [[{ count: toolKeyNull }]] = await connection.query("SELECT COUNT(*) AS count FROM ds_agent_tools WHERE tool_key IS NULL");
    const [[{ count: toolKeyDefault }]] = await connection.query("SELECT COUNT(*) AS count FROM ds_agent_tools WHERE tool_key = 'tool'");

    console.log("==================================================");
    console.log("DATA PREFLIGHT METRICS");
    console.log(`webhook_events rows: ${whTotal}`);
    console.log(`event_type IS NULL: ${whEventTypeNull}`);
    console.log(`status IS NULL: ${whStatusNull}`);
    console.log(`ds_agent_tools rows: ${toolTotal}`);
    console.log(`tool_key IS NULL: ${toolKeyNull}`);
    console.log(`tool_key = 'tool': ${toolKeyDefault}`);
    console.log("==================================================");
  } catch (err) {
    console.error("[Data Preflight] ❌ FAIL:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
