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

async function run() {
  console.log("Connecting to the database to add tenant_id to users...");
  const config = getDbConfig();
  const conn = await mysql.createConnection(config);

  try {
    // Check if tenant_id column already exists
    const [columns]: any = await conn.query(
      `SELECT count(*) as cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tenant_id'`,
      [config.database]
    );

    if (columns[0].cnt === 0) {
      console.log("Adding tenant_id column to users table...");
      await conn.query("ALTER TABLE users ADD COLUMN tenant_id VARCHAR(36) NULL");
      
      console.log("Adding foreign key for tenant_id...");
      await conn.query("ALTER TABLE users ADD CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE SET NULL");
      
      console.log("Column tenant_id added successfully!");
    } else {
      console.log("Column tenant_id already exists. Skipping.");
    }

  } catch (err) {
    console.error("Error migrating table:", err);
  } finally {
    await conn.end();
  }

  console.log("Done.");
}

run();
