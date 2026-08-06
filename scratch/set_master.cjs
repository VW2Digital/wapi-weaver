const mysql = require("mysql2/promise");

const DB_PASS = "S0xbxPfKazBVT8JFy1UEOjIsrjox";
const targetEmail = "vw2digital@gmail.com";

async function promoteToMaster() {
  const conn = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  });

  const [users] = await conn.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", [targetEmail]);
  if (users.length === 0) {
    console.log(`User ${targetEmail} not found!`);
    await conn.end();
    return;
  }

  const userId = users[0].id;
  await conn.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin_master')", [userId]);

  console.log(`Successfully updated ${targetEmail} (ID: ${userId}) to role 'admin_master'.`);
  await conn.end();
}

promoteToMaster().catch(console.error);
