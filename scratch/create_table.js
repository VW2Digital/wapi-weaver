import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  console.log("Creating payment_gateway_settings table...");
  await connection.query(`CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL UNIQUE,
    provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago',
    environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
    checkout_mode ENUM('redirect', 'transparent') NOT NULL DEFAULT 'redirect',
    sandbox_public_key TEXT NULL,
    sandbox_client_id TEXT NULL,
    sandbox_access_token TEXT NULL,
    sandbox_client_secret TEXT NULL,
    production_public_key TEXT NULL,
    production_client_id TEXT NULL,
    production_access_token TEXT NULL,
    production_client_secret TEXT NULL,
    webhook_secret TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_gateway_provider (provider)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  console.log("Table created successfully!");
  await connection.end();
}

main().catch(err => {
  console.error("Error creating table:", err);
  process.exit(1);
});
