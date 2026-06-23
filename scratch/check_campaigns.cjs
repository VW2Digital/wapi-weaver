const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
});

async function main() {
  const [rows] = await pool.execute(
    "SELECT id, name, status, created_at, scheduled_at FROM campaigns ORDER BY created_at DESC LIMIT 10"
  );
  console.log("LAST 10 CAMPAIGNS:");
  for (const row of rows) {
    console.log("-----------------------------------------");
    console.log("ID:", row.id);
    console.log("NAME:", row.name);
    console.log("STATUS:", row.status);
    console.log("CREATED AT:", row.created_at);
  }
  await pool.end();
}

main().catch(console.error);
