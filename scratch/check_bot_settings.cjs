const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "162.214.215.195",
    port: 3306,
    user: "wapi_user",
    password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: "wapi_weaver",
  });
  const [profiles] = await conn.query("SELECT id, whatsapp_phone_number_id FROM profiles");
  console.log("PROFILES:", profiles);

  const [settings] = await conn.query(
    "SELECT id, user_id, instance_id, is_active FROM bot_settings",
  );
  console.log("BOT_SETTINGS:", settings);

  await conn.end();
}

main().catch(console.error);
