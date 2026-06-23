const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
});

async function main() {
  const [rowsCountCM] = await pool.execute("SELECT COUNT(*) as cnt FROM campaign_messages");
  const [rowsCountC] = await pool.execute("SELECT COUNT(*) as cnt FROM campaigns");
  console.log("TOTAL CAMPAIGNS:", rowsCountC[0].cnt);
  console.log("TOTAL CAMPAIGN MESSAGES:", rowsCountCM[0].cnt);
  await pool.end();
}

main().catch(console.error);
