const mysql = require("mysql2/promise");

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });

  const [webhooks] = await pool.query(
    "SELECT id, user_id, source, processed, received_at FROM webhook_events WHERE source = ? ORDER BY received_at DESC LIMIT 10",
    ["whatsapp"],
  );
  const [contacts] = await pool.query(
    "SELECT id, user_id, phone_e164, channel, name, is_unread, chat_status, created_at, updated_at FROM contacts ORDER BY updated_at DESC LIMIT 15",
  );
  const [messages] = await pool.query(
    "SELECT id, user_id, contact_phone, channel, direction, type, body, wa_message_id, status, provider_account_id, created_at FROM direct_messages ORDER BY created_at DESC LIMIT 20",
  );
  const [whatsappMessages] = await pool.query(
    "SELECT id, user_id, contact_phone, channel, direction, type, body, wa_message_id, status, provider_account_id, created_at FROM direct_messages WHERE channel = 'whatsapp' ORDER BY created_at DESC LIMIT 20",
  );
  const [whatsappContacts] = await pool.query(
    "SELECT id, user_id, phone_e164, channel, name, is_unread, chat_status, created_at, updated_at FROM contacts WHERE channel = 'whatsapp' ORDER BY updated_at DESC LIMIT 20",
  );

  process.stdout.write(
    JSON.stringify(
      {
        webhooks,
        contacts,
        messages,
        whatsappContacts,
        whatsappMessages,
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch((error) => {
  process.stderr.write(String(error?.stack || error));
  process.exit(1);
});
