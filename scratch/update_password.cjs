const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { crypto } = require("crypto");
const fs = require("fs");
const path = require("path");

// Try to load env variables
let localDbConfig = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver",
};

try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*DB_([A-Z]+)\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) {
        const key = match[1].toLowerCase();
        let value = match[2];
        if (key === "port") value = parseInt(value, 10);
        if (key === "host") localDbConfig.host = value;
        if (key === "port") localDbConfig.port = value;
        if (key === "user") localDbConfig.user = value;
        if (key === "password") localDbConfig.password = value;
        if (key === "name") localDbConfig.database = value;
      }
    }
  }
} catch (e) {
  console.log("Error loading .env, using default local config:", e.message);
}

const vpsDbConfig = {
  host: "162.214.215.195",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver",
};

const email = "vanderleivw2@gmail.com";
const password = "vanderleivw2";

function generateUUID() {
  return require("crypto").randomUUID();
}

async function updateDatabase(config, name) {
  console.log(`\n--- Processing database: ${name} (${config.host}) ---`);
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("Connected successfully.");

    // Generate hash
    const passwordHash = bcrypt.hashSync(password, 10);

    // Check if user exists
    const [users] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    let userId;

    if (users.length > 0) {
      userId = users[0].id;
      console.log(`User found with ID: ${userId}. Updating password...`);
      await conn.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
      console.log("Password updated successfully.");
    } else {
      userId = generateUUID();
      console.log(`User not found. Creating new user with ID: ${userId}...`);
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        userId,
        email,
        passwordHash,
      ]);
      console.log("User created successfully.");
    }

    // Ensure user_roles exists and is admin
    const [roles] = await conn.query(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'admin'",
      [userId],
    );
    if (roles.length === 0) {
      console.log("Ensuring admin role...");
      await conn.query(
        "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin') ON DUPLICATE KEY UPDATE role='admin'",
        [generateUUID(), userId],
      );
      console.log("Admin role set.");
    } else {
      console.log("User already has admin role.");
    }

    // Ensure profile exists
    const [profiles] = await conn.query("SELECT id FROM profiles WHERE id = ?", [userId]);
    if (profiles.length === 0) {
      console.log("Creating user profile...");
      await conn.query("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
        userId,
        email,
        "Vanderlei Master",
      ]);
      console.log("Profile created.");
    } else {
      console.log("Profile already exists.");
    }

    console.log(`Success processing ${name}.`);
  } catch (error) {
    console.error(`Error processing database ${name}:`, error.message);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

async function main() {
  await updateDatabase(localDbConfig, "Local Database");
  await updateDatabase(vpsDbConfig, "VPS Database");
}

main().catch(console.error);
