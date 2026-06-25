const mysql = require("mysql2/promise");

const dbConfigLocal = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver"
};

async function checkUsers() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfigLocal);
    const [profiles] = await conn.query("SELECT id, email, full_name, display_name FROM profiles");
    console.log("Profiles in local db:", profiles);
    
    const [messages] = await conn.query("SELECT DISTINCT user_id, COUNT(*) as count FROM direct_messages GROUP BY user_id");
    console.log("Messages by user_id in direct_messages:", messages);
  } catch (err) {
    console.error("Failed:", err.message);
  } finally {
    if (conn) await conn.end();
  }
}

checkUsers().catch(console.error);
