const mysql = require("mysql2/promise");
async function run() {
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "wapi_user",
    password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: "wapi_weaver",
    port: 3306
  });
  const [rows] = await conn.query("SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wapi_weaver' AND COLUMN_NAME = 'note'");
  console.log(rows);
  conn.end();
}
run().catch(console.error);
