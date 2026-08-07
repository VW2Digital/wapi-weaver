const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "wapi_user",
      password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
      database: process.env.DB_NAME || "wapi_weaver"
    });
    const [tables] = await conn.query("SHOW TABLES LIKE 'payment_gateway_settings'");
    console.log("Tables:", tables);
    if (tables.length > 0) {
      const [cols] = await conn.query("DESCRIBE payment_gateway_settings");
      console.log("Cols:", cols.map(c => c.Field));
      const [rows] = await conn.query("SELECT * FROM payment_gateway_settings");
      console.log("Rows count:", rows.length);
      console.log("Rows:", rows);
    }
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    if (conn) await conn.end();
  }
}
main();
