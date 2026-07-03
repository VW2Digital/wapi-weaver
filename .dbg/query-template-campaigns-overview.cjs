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
    if (!process.env[key]) process.env[key] = value;
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

  const [rows] = await conn.query(
    `SELECT
       c.id,
       c.name,
       c.status,
       c.template_id,
       c.started_at,
       c.finished_at,
       c.created_at,
       JSON_EXTRACT(c.payload, '$.template_name') AS template_name,
       JSON_EXTRACT(c.payload, '$.language') AS language,
       JSON_EXTRACT(c.payload, '$.variables') AS variables,
       t.name AS linked_template_name,
       t.language AS linked_template_language,
       t.status AS linked_template_status
     FROM campaigns c
     LEFT JOIN templates t ON t.id = c.template_id
     WHERE c.message_type = 'template'
     ORDER BY c.created_at DESC
     LIMIT 15`,
  );

  process.stdout.write(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
