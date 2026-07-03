const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const USER_ID = process.argv[2] || "acff3186-4e4a-4242-a7a5-3e519265b244";
const NAME_FILTER = process.argv[3] || "";

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
    `SELECT user_id, id, name, language, status, meta_template_id, synced_at
     FROM templates
     WHERE user_id = ?
       AND (? = '' OR name LIKE CONCAT('%', ?, '%'))
     ORDER BY synced_at DESC, name ASC
     LIMIT 100`,
    [USER_ID, NAME_FILTER, NAME_FILTER],
  );

  process.stdout.write(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
