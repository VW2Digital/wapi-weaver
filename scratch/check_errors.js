const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
});

async function main() {
  const [rows] = await pool.execute(
    "SELECT id, status, error, payload FROM campaign_messages WHERE status = 'failed' ORDER BY failed_at DESC LIMIT 5"
  );
  console.log("LAST 5 FAILED CAMPAIGN MESSAGES:");
  for (const row of rows) {
    console.log("-----------------------------------------");
    console.log("ID:", row.id);
    console.log("STATUS:", row.status);
    console.log("PAYLOAD:", row.payload);
    console.log("ERROR TYPE:", typeof row.error);
    console.log("ERROR CONTENT:");
    try {
      const err = typeof row.error === "string" ? JSON.parse(row.error) : row.error;
      console.log(JSON.stringify(err, null, 2));
    } catch {
      console.log(row.error);
    }
  }
  await pool.end();
}

main().catch(console.error);
