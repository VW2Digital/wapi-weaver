const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

let localDbConfig = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver"
};

try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*DB_([A-Z]+)\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) {
        const key = match[1].toLowerCase();
        let value = match[2];
        if (key === "port") value = parseInt(value, 10);
        if (key === "host") localDbConfig.host = value;
        if (key === "port") localDbConfig.port = value;
        if (key === "user") localDbConfig.user = value;
        if (key === "password") localDbConfig.password = value;
        if (key === "name") localDbConfig.database = value;
      }
    }
  }
} catch (e) {
  console.log("Error loading .env, using default local config:", e.message);
}

async function main() {
  const conn = await mysql.createConnection(localDbConfig);
  try {
    console.log("Connected to local database.");

    // Get user id for vanderleivw2@gmail.com
    const [users] = await conn.query("SELECT id, email FROM users WHERE email = 'vanderleivw2@gmail.com'");
    if (users.length === 0) {
      console.log("User vanderleivw2@gmail.com not found!");
      return;
    }
    const userId = users[0].id;
    console.log(`User ID: ${userId}`);

    // Check profiles
    const [profiles] = await conn.query("SELECT id, whatsapp_phone_number_id, whatsapp_access_token FROM profiles WHERE id = ?", [userId]);
    console.log("Profile details:", profiles[0]);

    // Check bot_settings
    const [settings] = await conn.query("SELECT * FROM bot_settings WHERE user_id = ?", [userId]);
    console.log("\n--- bot_settings ---");
    console.log(settings);

    if (settings.length > 0) {
      const botSettingsId = settings[0].id;
      // Check bot_steps
      const [steps] = await conn.query("SELECT id, step_order, trigger_type, trigger_value, message_type, message_content FROM bot_steps WHERE bot_settings_id = ? ORDER BY step_order", [botSettingsId]);
      console.log(`\n--- bot_steps (${steps.length} steps) ---`);
      console.log(steps);
    }
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
