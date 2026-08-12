import mysql from "mysql2/promise";
import { randomUUID, createHash } from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
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
  const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();

  if (!adminPassword) {
    console.error("[Provision Admin] ❌ CRITICAL: ADMIN_PASSWORD environment variable is missing or empty!");
    process.exit(1);
  }

  console.log(`[Provision Admin] Provisioning master admin user: ${adminEmail}`);

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Provision Admin] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || "mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: dbPassword,
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  let attempts = 0;
  while (attempts < 10) {
    try {
      connection = await mysql.createConnection(dbConfig);
      break;
    } catch (err) {
      attempts++;
      console.log(`[Provision Admin] Waiting for MySQL... (${attempts}/10)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connection) {
    console.error("[Provision Admin] Failed to connect to MySQL database.");
    process.exit(1);
  }

  try {
    const [users] = await connection.execute(
      "SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1",
      [adminEmail]
    );

    let userId;
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    if (users.length > 0) {
      userId = users[0].id;
      console.log(`[Provision Admin] Existing user found (ID: ${userId}). Updating password & ensuring admin_master role...`);
      await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
    } else {
      userId = randomUUID();
      console.log(`[Provision Admin] Creating new user (ID: ${userId})...`);
      await connection.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        userId,
        adminEmail,
        passwordHash,
      ]);
    }

    // Ensure profile exists
    const [profiles] = await connection.execute("SELECT id FROM profiles WHERE id = ? LIMIT 1", [userId]);
    if (profiles.length === 0) {
      await connection.execute(
        "INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)",
        [userId, adminEmail, "Master Admin"]
      );
    } else {
      await connection.execute("UPDATE profiles SET display_name = 'Master Admin' WHERE id = ?", [userId]);
    }

    // Ensure role is admin_master
    await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
    await connection.execute(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin_master')",
      [randomUUID(), userId]
    );

    // Ensure initial active license exists for this tenant
    const [licenses] = await connection.execute("SELECT id FROM licenses WHERE tenant_id = ? LIMIT 1", [userId]);
    if (licenses.length === 0) {
      const keyHash = createHash("sha256").update(adminEmail).digest("hex");
      await connection.execute(
        `INSERT INTO licenses (id, license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), keyHash, adminEmail, "Master Admin", adminEmail, "pro", "active", userId]
      );
    }

    console.log(`[Provision Admin] Successfully provisioned admin_master for ${adminEmail}.`);
    process.exit(0);
  } catch (err) {
    console.error("[Provision Admin] Error provisioning admin_master:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
