const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const PROFILE_ID = "acff3186-4e4a-4242-a7a5-3e519265b244";

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

function maskToken(token) {
  if (typeof token !== "string" || token.length < 16) return token ?? null;
  return `${token.slice(0, 12)}...${token.slice(-6)}`;
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
       whatsapp_phone_number_id,
       whatsapp_waba_id,
       whatsapp_access_token,
       whatsapp_app_id,
       whatsapp_app_secret,
       meta_graph_version
     FROM profiles
     WHERE id = ?`,
    [PROFILE_ID],
  );
  await conn.end();

  const profile = rows[0];
  if (!profile) {
    throw new Error("Perfil não encontrado");
  }
  if (!profile.whatsapp_access_token || !profile.whatsapp_app_id || !profile.whatsapp_app_secret) {
    throw new Error("Credenciais Meta incompletas no perfil");
  }

  const appAccessToken = `${profile.whatsapp_app_id}|${profile.whatsapp_app_secret}`;
  const debugUrl =
    "https://graph.facebook.com/debug_token" +
    `?input_token=${encodeURIComponent(profile.whatsapp_access_token)}` +
    `&access_token=${encodeURIComponent(appAccessToken)}`;

  const response = await fetch(debugUrl);
  const body = await response.json();

  process.stdout.write(
    JSON.stringify(
      {
        profile: {
          whatsapp_phone_number_id: profile.whatsapp_phone_number_id ?? null,
          whatsapp_waba_id: profile.whatsapp_waba_id ?? null,
          whatsapp_app_id: profile.whatsapp_app_id ?? null,
          meta_graph_version: profile.meta_graph_version ?? null,
          token_length:
            typeof profile.whatsapp_access_token === "string"
              ? profile.whatsapp_access_token.length
              : null,
          token_mask: maskToken(profile.whatsapp_access_token),
        },
        debug_token: {
          ok: response.ok,
          status: response.status,
          body,
        },
      },
      null,
      2,
    ),
  );

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
