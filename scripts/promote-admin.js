import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Erro: Por favor, insira o e-mail do usuário.");
    console.log("Uso: node scripts/promote-admin.js usuario@email.com");
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. Find user by email
    const [users] = await connection.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()]
    );

    if (!users.length) {
      console.error(`Erro: Nenhum usuário encontrado com o e-mail ${email}`);
      process.exit(1);
    }

    const userId = users[0].id;

    // 2. Check if already has admin role
    const [roles] = await connection.execute(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'admin' LIMIT 1",
      [userId]
    );

    if (roles.length) {
      console.log(`Sucesso: O usuário ${email} já é um administrador.`);
      process.exit(0);
    }

    // 3. Promote to admin
    const roleId = randomUUID();
    await connection.execute(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')",
      [roleId, userId]
    );

    console.log(`Sucesso: O usuário ${email} foi promovido a administrador!`);
  } catch (error) {
    console.error("Erro ao executar script:", error.message);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
