import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
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
  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.query("SELECT * FROM payment_gateway_settings");

  console.log("=== PAYMENT GATEWAY SETTINGS ROWS IN DB ===");
  console.log("Rows count:", rows.length);
  for (const row of rows) {
    console.log({
      id: row.id,
      tenant_id: row.tenant_id,
      provider: row.provider,
      environment: row.environment,
      checkout_mode: row.checkout_mode,
      sandbox_public_key: row.sandbox_public_key,
      sandbox_access_token_len: row.sandbox_access_token ? row.sandbox_access_token.length : 0,
      sandbox_access_token_has_colon: row.sandbox_access_token ? row.sandbox_access_token.includes(":") : false,
      sandbox_access_token_raw: row.sandbox_access_token,
      production_access_token_raw: row.production_access_token,
    });
  }

  const outputDir = path.resolve(rootDir, "scratch");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.resolve(outputDir, "gateway_db_dump.json"), JSON.stringify(rows, null, 2));

  await connection.end();
}

main().catch(console.error);
