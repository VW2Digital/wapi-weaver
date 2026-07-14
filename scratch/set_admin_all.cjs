const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { randomUUID, createHash } = require("crypto");

const DB_PASS = "S0xbxPfKazBVT8JFy1UEOjIsrjox";

const configs = [
  {
    name: "VPS Database",
    host: "162.214.215.195",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  },
  {
    name: "Local Database",
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: DB_PASS,
    database: "wapi_weaver",
  }
];

const targetEmails = ["vanderleivw2@gmail.com", "vw2digital@gmail.com"];

async function run() {
  for (const config of configs) {
    console.log(`\n=================== Connecting to ${config.name} (${config.host}) ===================`);
    let conn;
    try {
      conn = await mysql.createConnection(config);
      console.log(`Connected to ${config.name}!`);

      for (const targetEmail of targetEmails) {
        console.log(`\nProcessing user: ${targetEmail}`);
        const [users] = await conn.query("SELECT id, email FROM users WHERE LOWER(email) = ?", [targetEmail.toLowerCase()]);
        
        if (users.length > 0) {
          const userId = users[0].id;
          console.log(`User found with ID: ${userId}. Updating role to adminmaster...`);
          
          // Delete existing roles
          await conn.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
          // Insert role adminmaster
          await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'adminmaster')", [userId]);
          
          // Ensure license exists
          const [licenses] = await conn.query("SELECT id FROM licenses WHERE tenant_id = ? LIMIT 1", [userId]);
          if (licenses.length === 0) {
            const keyHash = createHash("sha256").update(targetEmail).digest("hex");
            await conn.query(
              `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [keyHash, targetEmail, "Master Admin", targetEmail, "basic", "active", userId]
            );
            console.log(`Provisioned license subscription for ${targetEmail}`);
          }
          
          console.log(`SUCCESS: ${targetEmail} is now adminmaster.`);
        } else {
          console.log(`User ${targetEmail} not found. Creating user...`);
          const userId = randomUUID();
          const defaultPassword = "adminmaster123";
          const passwordHash = await bcrypt.hash(defaultPassword, 10);
          
          await conn.beginTransaction();
          try {
            // 1. Insert user
            await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
              userId,
              targetEmail,
              passwordHash,
            ]);
            
            // 2. Insert user role
            await conn.execute("INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'adminmaster')", [
              userId,
            ]);
            
            // 3. Insert profile
            await conn.execute("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
              userId,
              targetEmail,
              "Admin Master",
            ]);
            
            // 4. Create license
            const keyHash = createHash("sha256").update(targetEmail).digest("hex");
            await conn.execute(
              `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [keyHash, targetEmail, "Admin Master", targetEmail, "basic", "active", userId]
            );
            
            await conn.commit();
            console.log(`SUCCESS: Created ${targetEmail} with role adminmaster. Default password: '${defaultPassword}'`);
          } catch (txErr) {
            await conn.rollback();
            console.error(`Failed to create user ${targetEmail}:`, txErr);
          }
        }
      }
    } catch (err) {
      console.error(`Could not complete operations on ${config.name}:`, err.message);
    } finally {
      if (conn) await conn.end();
    }
  }
  process.exit(0);
}

run();
