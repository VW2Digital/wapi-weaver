import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import crypto from "node:crypto";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("[Admin] ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios.");
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "wapi_weaver",
});

try {
  await connection.beginTransaction();

  const [users] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  const userId = users[0]?.id || crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  if (users.length === 0) {
    await connection.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      userId,
      email,
      passwordHash,
    ]);
  } else {
    await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      userId,
    ]);
  }

  await connection.query(
    `INSERT INTO profiles (id, email, display_name)
     VALUES (?, ?, 'Administrador Master')
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       display_name = VALUES(display_name)`,
    [userId, email],
  );
  await connection.query(
    `INSERT INTO user_roles (id, user_id, role)
     VALUES (?, ?, 'admin_master')
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [crypto.randomUUID(), userId],
  );

  const [masterRoles] = await connection.query(
    "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin_master' LIMIT 1",
    [userId],
  );
  if (masterRoles.length !== 1) {
    throw new Error(`Não foi possível confirmar admin_master para ${email}.`);
  }

  await connection.commit();
  console.log(`[Admin] ${email} provisionado como admin_master.`);
} catch (error) {
  await connection.rollback();
  console.error("[Admin] Falha ao provisionar administrador:", error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
