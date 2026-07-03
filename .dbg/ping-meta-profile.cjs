const mysql = require("mysql2/promise");

const PROFILE_ID = "acff3186-4e4a-4242-a7a5-3e519265b244";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  const [rows] = await conn.query(
    `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
     FROM profiles
     WHERE id = ?`,
    [PROFILE_ID],
  );
  await conn.end();

  const profile = rows[0];
  if (!profile?.whatsapp_phone_number_id || !profile?.whatsapp_access_token) {
    throw new Error("Credenciais da Meta não configuradas no perfil");
  }

  const apiVersion = profile.meta_graph_version || "v20.0";
  const fields =
    "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type";

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_phone_number_id}?fields=${fields}`,
    {
      headers: {
        Authorization: `Bearer ${profile.whatsapp_access_token}`,
      },
    },
  );

  const body = await response.json();
  process.stdout.write(JSON.stringify({ ok: response.ok, status: response.status, body }, null, 2));
  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
