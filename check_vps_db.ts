import mysql from "mysql2/promise";

async function run() {
  const conn = await mysql.createConnection({
    host: "162.214.215.195",
    port: 3306,
    user: "wapi_user",
    password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: "wapi_weaver",
  });

  const [users] = await conn.query(
    "SELECT u.id, u.email, r.role FROM users u LEFT JOIN user_roles r ON u.id = r.user_id",
  );
  console.log("VPS Users & Roles:", users);

  // We will also just promote vanderleivw2@gmail.com to admin right away!
  const targetEmail = "vanderleivw2@gmail.com";
  const targetUser = (users as any[]).find((u: any) => u.email === targetEmail);

  if (targetUser) {
    await conn.query(
      `INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin') ON DUPLICATE KEY UPDATE role='admin'`,
      [targetUser.id],
    );
    console.log(`Promoted ${targetEmail} to admin on VPS!`);
  } else {
    console.log(`${targetEmail} not found on VPS!`);
  }

  process.exit();
}
run().catch(console.error);
