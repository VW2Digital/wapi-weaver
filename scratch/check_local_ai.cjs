const mysql = require("mysql2/promise");

const dbConfig = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver"
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [users] = await conn.query("SELECT id, email FROM users");
    console.log("Users in local DB:", users);

    const [profiles] = await conn.query("SELECT id, whatsapp_phone_number_id, whatsapp_access_token FROM profiles");
    console.log("Profiles in local DB:", profiles);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await conn.end();
  }
}

main();
