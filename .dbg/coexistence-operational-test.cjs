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

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function main() {
  loadDotEnv();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  const [rows] = await connection.query(
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
  await connection.end();

  const profile = rows[0];
  if (!profile) {
    throw new Error("Perfil não encontrado");
  }
  if (
    !profile.whatsapp_phone_number_id ||
    !profile.whatsapp_access_token ||
    !profile.whatsapp_app_id ||
    !profile.whatsapp_app_secret
  ) {
    throw new Error("Credenciais Meta incompletas no perfil");
  }

  const apiVersion = profile.meta_graph_version || "v20.0";
  const appAccessToken = `${profile.whatsapp_app_id}|${profile.whatsapp_app_secret}`;
  const phoneId = String(profile.whatsapp_phone_number_id);
  const accessToken = String(profile.whatsapp_access_token);

  const debugToken = await fetchJson(
    "https://graph.facebook.com/debug_token" +
      `?input_token=${encodeURIComponent(accessToken)}` +
      `&access_token=${encodeURIComponent(appAccessToken)}`,
    {},
  );

  const coexistenceStatus = await fetchJson(
    `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=id,display_phone_number,verified_name,status,quality_rating,platform_type,is_on_biz_app`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const syncContacts = await fetchJson(
    `https://graph.facebook.com/${apiVersion}/${phoneId}/smb_app_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "smb_app_state_sync",
      }),
    },
  );

  const syncHistory = await fetchJson(
    `https://graph.facebook.com/${apiVersion}/${phoneId}/smb_app_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: "history",
      }),
    },
  );

  process.stdout.write(
    JSON.stringify(
      {
        profile: {
          whatsapp_phone_number_id: phoneId,
          whatsapp_waba_id: String(profile.whatsapp_waba_id || ""),
          whatsapp_app_id: String(profile.whatsapp_app_id || ""),
          meta_graph_version: apiVersion,
          token_length: accessToken.length,
          token_mask: maskToken(accessToken),
        },
        debugToken,
        coexistenceStatus,
        syncContacts,
        syncHistory,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
