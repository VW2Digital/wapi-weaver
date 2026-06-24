const mysql = require("mysql2/promise");

const vpsDbConfig = {
  host: "162.214.215.195",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver"
};

async function main() {
  let conn;
  try {
    console.log("Connecting to VPS database...");
    conn = await mysql.createConnection(vpsDbConfig);
    console.log("Connected successfully.");

    // Get user id for vanderleivw2@gmail.com
    const [users] = await conn.query("SELECT id, email FROM users WHERE email = 'vanderleivw2@gmail.com'");
    if (users.length === 0) {
      console.log("User vanderleivw2@gmail.com not found on VPS!");
      return;
    }
    const userId = users[0].id;
    console.log(`User ID on VPS: ${userId}`);

    // Check profiles
    const [profiles] = await conn.query("SELECT id, whatsapp_phone_number_id, whatsapp_access_token FROM profiles WHERE id = ?", [userId]);
    console.log("Profile details on VPS:", profiles[0]);

    // Check bot_settings
    const [settings] = await conn.query("SELECT * FROM bot_settings WHERE user_id = ?", [userId]);
    console.log("\n--- bot_settings on VPS ---");
    console.log(settings);

    if (settings.length > 0) {
      const botSettingsId = settings[0].id;
      // Check bot_steps
      const [steps] = await conn.query("SELECT id, step_order, trigger_type, trigger_value, message_type, message_content FROM bot_steps WHERE bot_settings_id = ? ORDER BY step_order", [botSettingsId]);
      console.log(`\n--- bot_steps on VPS (${steps.length} steps) ---`);
      console.log(steps);
    }
  } catch (error) {
    console.error("VPS Database query failed:", error.message);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main().catch(console.error);
