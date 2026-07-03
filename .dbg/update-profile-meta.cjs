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

  await conn.execute(
    `UPDATE profiles
     SET whatsapp_phone_number_id = ?,
         whatsapp_waba_id = ?,
         whatsapp_business_id = ?,
         whatsapp_business_phone = ?,
         whatsapp_app_id = ?,
         whatsapp_app_secret = ?,
         rate_limit_per_second = ?
     WHERE id = ?`,
    [
      "1107720082434785",
      "1252390143469267",
      "1258176729434754",
      "5591936180534",
      "1783038629742610",
      "063c8e0505fa19e82061226f463227ba",
      10,
      PROFILE_ID,
    ],
  );

  const [rows] = await conn.query(
    `SELECT
        id,
        whatsapp_phone_number_id,
        whatsapp_waba_id,
        whatsapp_business_id,
        whatsapp_business_phone,
        whatsapp_app_id,
        rate_limit_per_second
      FROM profiles
      WHERE id = ?`,
    [PROFILE_ID],
  );

  process.stdout.write(JSON.stringify(rows[0] || null, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
