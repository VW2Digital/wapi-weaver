const mysql = require("mysql2/promise");

const DB_PASS = "S0xbxPfKazBVT8JFy1UEOjIsrjox";

const configs = [
  {
    name: "Local Database",
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  }
];

const emailToDelete = "vanderleivw2@gmail.com";

async function run() {
  for (const config of configs) {
    console.log(`Connecting to ${config.name}...`);
    let conn;
    try {
      conn = await mysql.createConnection(config);
      
      const [users] = await conn.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", [emailToDelete]);
      const userIds = users.map(u => u.id);

      console.log(`Found ${userIds.length} user(s) matching ${emailToDelete}`);

      for (const id of userIds) {
        await conn.query("DELETE FROM team_members WHERE user_id = ?", [id]);
        await conn.query("DELETE FROM user_roles WHERE user_id = ?", [id]);
        await conn.query("DELETE FROM profiles WHERE id = ?", [id]);
        await conn.query("DELETE FROM licenses WHERE tenant_id = ?", [id]);
        await conn.query("DELETE FROM users WHERE id = ?", [id]);
      }

      await conn.query("DELETE FROM licenses WHERE LOWER(TRIM(client_email)) = LOWER(TRIM(?))", [emailToDelete]);

      console.log(`Successfully purged ${emailToDelete} from all tables.`);
    } catch (err) {
      console.error("Error purging user:", err);
    } finally {
      if (conn) await conn.end();
    }
  }
  process.exit(0);
}

run();
