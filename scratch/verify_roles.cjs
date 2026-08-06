const mysql = require("mysql2/promise");

const DB_PASS = "S0xbxPfKazBVT8JFy1UEOjIsrjox";

async function verify() {
  const conn = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  });

  console.log("=== 1. DISTRIBUTION OF ROLES ===");
  const [roleCounts] = await conn.query("SELECT role, COUNT(*) as count FROM user_roles GROUP BY role");
  console.log(roleCounts);

  console.log("\n=== 2. USERS WITHOUT ROLE ===");
  const [noRoles] = await conn.query("SELECT id, email FROM users WHERE id NOT IN (SELECT user_id FROM user_roles)");
  console.log(noRoles);

  console.log("\n=== 3. USERS WITH MULTIPLE ROLES ===");
  const [multiRoles] = await conn.query("SELECT user_id, COUNT(*) as count FROM user_roles GROUP BY user_id HAVING count > 1");
  console.log(multiRoles);

  console.log("\n=== 4. USERS & ROLES DETAILS ===");
  const [userRoles] = await conn.query("SELECT u.id, u.email, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id");
  console.log(userRoles);

  console.log("\n=== 5. UNIQUE INDEX ON user_roles ===");
  const [indexes] = await conn.query("SHOW INDEX FROM user_roles WHERE Non_unique = 0");
  console.log(indexes.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name })));

  await conn.end();
}

verify().catch(console.error);
