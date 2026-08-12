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

  console.log("=== DESCRIBE opportunity_contacts ===");
  const [cols] = await connection.query("DESCRIBE `opportunity_contacts`");
  console.table(cols);

  console.log("=== SHOW KEYS FROM opportunity_contacts ===");
  const [keys] = await connection.query("SHOW KEYS FROM `opportunity_contacts`");
  console.table(keys);

  console.log("=== SAMPLE DATA FROM opportunity_contacts ===");
  const [rows] = await connection.query("SELECT * FROM `opportunity_contacts` LIMIT 5");
  console.table(rows);

  await connection.end();
}

main().catch(console.error);
