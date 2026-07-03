const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const TEMPLATE_NAME = process.argv[2] || "confirmacao_cadastro";
const TEMPLATE_LANG = process.argv[3] || "pt_BR";

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
       id,
       name,
       language,
       status,
       category,
       parameter_format,
       meta_template_id,
       components,
       synced_at
     FROM templates
     WHERE name = ? AND language = ?
     ORDER BY synced_at DESC`,
    [TEMPLATE_NAME, TEMPLATE_LANG],
  );

  process.stdout.write(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
