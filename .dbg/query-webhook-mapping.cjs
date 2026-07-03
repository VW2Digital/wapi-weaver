const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  const [profiles] = await conn.query(
    "SELECT id, email, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_verify_token FROM profiles WHERE whatsapp_phone_number_id IS NOT NULL ORDER BY id ASC",
  );

  const [events] = await conn.query(
    `SELECT
        id,
        user_id,
        source,
        received_at,
        JSON_UNQUOTE(JSON_EXTRACT(raw, '$.entry[0].changes[0].value.metadata.phone_number_id')) AS phone_number_id,
        JSON_UNQUOTE(JSON_EXTRACT(raw, '$.entry[0].changes[0].field')) AS field_name
      FROM webhook_events
      WHERE source = 'whatsapp'
      ORDER BY received_at DESC
      LIMIT 20`,
  );

  const [rejectedEvents] = await conn.query(
    `SELECT
        id,
        user_id,
        source,
        received_at,
        JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reason')) AS reason,
        JSON_UNQUOTE(JSON_EXTRACT(raw, '$.phone_number_ids[0]')) AS phone_number_id
      FROM webhook_events
      WHERE source = 'whatsapp' AND user_id IS NULL
      ORDER BY received_at DESC
      LIMIT 20`,
  );

  process.stdout.write(JSON.stringify({ profiles, events, rejectedEvents }, null, 2));
  await conn.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
