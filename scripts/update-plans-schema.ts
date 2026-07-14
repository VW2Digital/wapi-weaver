import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Function to load the connection string from .env
function getDbConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const envFile = fs.readFileSync(envPath, "utf-8");
  
  const env: Record<string, string> = {};
  envFile.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) {
      env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, '');
    }
  });

  if (!env.DB_USER || !env.DB_PASSWORD || !env.DB_HOST || !env.DB_PORT || !env.DB_NAME) {
    throw new Error("Missing database credentials in .env");
  }

  return {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT),
    database: env.DB_NAME,
  };
}

async function run() {
  console.log("Connecting to the database...");
  const config = getDbConfig();
  
  // Create a connection pool
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  try {
    console.log("Creating subscription_plans table...");
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(80) NOT NULL UNIQUE,
        description TEXT NULL,
        max_agents INT DEFAULT 1,
        max_funnels INT DEFAULT 1,
        max_users INT DEFAULT 1,
        features_json JSON NULL,
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createTableQuery);
    console.log("Table subscription_plans ensured successfully!");

    // Insert default plans if they don't exist
    console.log("Inserting default plans...");
    const defaultPlans = [
      { id: crypto.randomUUID(), name: "Básico", slug: "basic", desc: "Plano de entrada", ag: 1, fn: 3, us: 2 },
      { id: crypto.randomUUID(), name: "Premium", slug: "premium", desc: "Para pequenos negócios", ag: 5, fn: 10, us: 5 },
      { id: crypto.randomUUID(), name: "Enterprise", slug: "enterprise", desc: "Para grandes operações", ag: 999, fn: 999, us: 999 },
    ];

    for (const p of defaultPlans) {
      // Use INSERT IGNORE based on slug since slug is UNIQUE
      const checkResult = await pool.query("SELECT id FROM subscription_plans WHERE slug = ?", [p.slug]) as any;
      if (checkResult[0].length === 0) {
        await pool.query(
          `INSERT INTO subscription_plans (id, name, slug, description, max_agents, max_funnels, max_users) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.slug, p.desc, p.ag, p.fn, p.us]
        );
      }
    }
    console.log("Default plans inserted/ensured.");

  } catch (error) {
    console.error("Error creating schema:", error);
  } finally {
    await pool.end();
    console.log("Done.");
  }
}

run();
