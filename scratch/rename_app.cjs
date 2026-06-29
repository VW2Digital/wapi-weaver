const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Load .env manually
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        // remove surrounding quotes
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

// 2. Update DB setting
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
});

async function updateDb() {
  try {
    const [result] = await pool.execute(
      "UPDATE platform_settings SET seo_title = 'Bliv' WHERE id = 1"
    );
    console.log("DB update query executed.", result);
  } catch (err) {
    console.error("Failed to update database seo_title:", err.message);
  } finally {
    await pool.end();
  }
}

updateDb();
