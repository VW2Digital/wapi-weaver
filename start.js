import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import server from "./dist/server/server.js";
import mysql from "mysql2/promise";

async function ensureColumnExists(connection, tableName, columnName, columnDefinition) {
  try {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (columns.length === 0) {
      console.log(`Adding missing column \`${columnName}\` to table \`${tableName}\`...`);
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`Column \`${columnName}\` added successfully.`);
    }
  } catch (err) {
    console.error(`Error ensuring column \`${columnName}\` in table \`${tableName}\`:`, err);
  }
}

async function initDatabase() {
  try {
    console.log("Auto-migrating database schema...");
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "wapi_user",
      password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
      database: process.env.DB_NAME || "wapi_weaver",
    });

    console.log("Checking columns in profiles table...");
    await ensureColumnExists(connection, "profiles", "rate_limit_per_second", "INT NOT NULL DEFAULT 10");
    await ensureColumnExists(connection, "profiles", "whatsapp_verify_token", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_access_token", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_phone_number_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_waba_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_phone", "VARCHAR(50) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_app_secret", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "meta_graph_version", "VARCHAR(50) NOT NULL DEFAULT 'v20.0'");
    await ensureColumnExists(connection, "profiles", "salvy_api_key", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "api_key", "VARCHAR(255) NULL");

    console.log("Ensuring table direct_messages exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        direction ENUM('incoming', 'outgoing') NOT NULL,
        type ENUM('text', 'reaction', 'image') NOT NULL DEFAULT 'text',
        body TEXT NOT NULL,
        wa_message_id VARCHAR(255) NULL,
        status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
        reply_to_message_id VARCHAR(255) NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Ensuring index idx_direct_messages_user_phone exists...");
    try {
      await connection.query(`
        CREATE INDEX idx_direct_messages_user_phone ON direct_messages(user_id, contact_phone);
      `);
    } catch (err) {
      if (err.code !== "ER_DUP_KEYNAME") {
        console.warn("Could not create user_phone index:", err.message);
      }
    }

    console.log("Ensuring index idx_direct_messages_wa_id exists...");
    try {
      await connection.query(`
        CREATE INDEX idx_direct_messages_wa_id ON direct_messages(wa_message_id);
      `);
    } catch (err) {
      if (err.code !== "ER_DUP_KEYNAME") {
        console.warn("Could not create wa_id index:", err.message);
      }
    }

    console.log("Database schema is up to date.");
    await connection.end();
  } catch (error) {
    console.error("Error during database auto-migration:", error);
  }
}

// Run database init on startup
await initDatabase();

const app = new Hono();

// Serve static assets from dist/client
app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ root: "./dist/client" }));

// Pass all other requests to the TanStack Start SSR fetch handler
app.all("*", async (c) => {
  return server.fetch(c.req.raw);
});

const port = process.env.PORT || 3000;

console.log(`Starting Node server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: Number(port),
});
