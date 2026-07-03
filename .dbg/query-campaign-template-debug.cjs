const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnv();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  const [messages] = await conn.query(
    `SELECT
       cm.id,
       cm.user_id,
       cm.campaign_id,
       cm.contact_id,
       cm.to_phone,
       cm.status,
       cm.failed_at,
       cm.error,
       c.message_type,
       c.payload,
       ct.name AS contact_name,
       ct.custom_fields AS contact_custom_fields
     FROM campaign_messages cm
     JOIN campaigns c ON c.id = cm.campaign_id
     LEFT JOIN contacts ct ON ct.id = cm.contact_id
     WHERE c.message_type = 'template'
     ORDER BY COALESCE(cm.failed_at, cm.created_at) DESC
     LIMIT 10`,
  );

  process.stdout.write(JSON.stringify(messages, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
