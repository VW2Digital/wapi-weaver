const mysql = require("mysql2/promise");

const DB_PASS = "S0xbxPfKazBVT8JFy1UEOjIsrjox";

async function checkRoles() {
  const conn = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  });

  const [rolesCount] = await conn.query("SELECT role, COUNT(*) as count FROM user_roles GROUP BY role");
  console.log("=== Distribuicao de roles no banco ===");
  console.log(rolesCount);

  const [usersWithRoles] = await conn.query(`
    SELECT u.id, u.email, ur.role 
    FROM users u 
    LEFT JOIN user_roles ur ON u.id = ur.user_id
  `);
  console.log("\n=== Usuarios e suas roles ===");
  console.log(usersWithRoles);

  await conn.end();
}

checkRoles().catch(console.error);
