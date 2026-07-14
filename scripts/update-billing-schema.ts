import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function getDbConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const envFile = fs.readFileSync(envPath, "utf-8");
  
  const env: Record<string, string> = {};
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...value] = trimmed.split("=");
      env[key] = value.join("=").replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  });

  return {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME || "wapi_weaver",
  };
}

async function addColumnIfNotExists(conn: mysql.Connection, dbName: string, tableName: string, columnName: string, columnDef: string) {
  const [columns]: any = await conn.query(
    `SELECT count(*) as cnt FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName]
  );
  if (columns[0].cnt === 0) {
    console.log(`Adding ${columnName} to ${tableName}...`);
    await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`);
  }
}

async function run() {
  console.log("Connecting to the database for billing schema migration...");
  const config = getDbConfig();
  const conn = await mysql.createConnection(config);

  try {
    // 1. Extend subscription_plans
    await addColumnIfNotExists(conn, config.database, "subscription_plans", "stripe_product_id", "VARCHAR(255) NULL");
    await addColumnIfNotExists(conn, config.database, "subscription_plans", "stripe_price_id", "VARCHAR(255) NULL");
    await addColumnIfNotExists(conn, config.database, "subscription_plans", "max_ai_tokens", "INT NOT NULL DEFAULT 500000"); // 500k tokens default
    
    // 2. Extend licenses
    await addColumnIfNotExists(conn, config.database, "licenses", "stripe_customer_id", "VARCHAR(255) NULL");
    await addColumnIfNotExists(conn, config.database, "licenses", "stripe_subscription_id", "VARCHAR(255) NULL");
    await addColumnIfNotExists(conn, config.database, "licenses", "ai_tokens_used", "INT NOT NULL DEFAULT 0");

    // 3. Create ai_usage_logs table
    console.log("Creating ai_usage_logs table...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        contact_phone VARCHAR(50) NULL,
        model VARCHAR(100) NOT NULL,
        prompt_tokens INT NOT NULL DEFAULT 0,
        completion_tokens INT NOT NULL DEFAULT 0,
        total_tokens INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_tenant (tenant_id, created_at),
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Schema migration completed successfully!");
  } catch (err) {
    console.error("Error migrating table:", err);
  } finally {
    await conn.end();
  }

  console.log("Done.");
}

run();
