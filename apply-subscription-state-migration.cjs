require("dotenv").config();
const mysql = require("mysql2/promise");

async function runMigration() {
  console.log("=== INICIANDO MIGRATION DA MÁQUINA DE ESTADOS DE ASSINATURAS ===");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // 1. Garantir que a tabela subscriptions existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        customer_id VARCHAR(255) NULL,
        plan_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        starts_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        grace_period_ends_at DATETIME NULL,
        auto_renew TINYINT(1) DEFAULT 1,
        payment_provider VARCHAR(32) DEFAULT 'mercado_pago',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subscriptions_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[OK] Tabela subscriptions verificada.");

    // 2. Adicionar colunas payment_provider e grace_period_ends_at se não existirem
    const [columns] = await pool.query("SHOW COLUMNS FROM subscriptions");
    const colNames = columns.map((c) => c.Field);

    if (!colNames.includes("payment_provider")) {
      console.log("Adicionando coluna payment_provider na tabela subscriptions...");
      await pool.query("ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(32) DEFAULT 'mercado_pago'");
    }

    if (!colNames.includes("grace_period_ends_at")) {
      console.log("Adicionando coluna grace_period_ends_at na tabela subscriptions...");
      await pool.query("ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at DATETIME NULL");
    }

    // 3. Mapear status legados para a nova máquina de estados
    await pool.query("UPDATE subscriptions SET status = 'active' WHERE status IN ('trial', 'expiring')");
    await pool.query("UPDATE subscriptions SET status = 'suspended' WHERE status = 'expired'");
    console.log("[OK] Status legados mapeados com sucesso.");

    // 4. Criar tabela subscription_events se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_events (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        subscription_id VARCHAR(36) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        previous_status VARCHAR(32) NULL,
        new_status VARCHAR(32) NULL,
        source VARCHAR(64) NOT NULL,
        gateway_event_id VARCHAR(255) NULL,
        raw_payload LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sub_events_tenant (tenant_id),
        INDEX idx_sub_events_sub (subscription_id),
        UNIQUE KEY idx_sub_events_source_gateway (source, gateway_event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[OK] Tabela subscription_events pronta com índice único.");

    // 5. Criar tabela subscription_plan_changes se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_plan_changes (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        subscription_id VARCHAR(36) NOT NULL,
        old_plan VARCHAR(64) NOT NULL,
        new_plan VARCHAR(64) NOT NULL,
        effective_date DATETIME NOT NULL,
        applied_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_plan_changes_tenant (tenant_id),
        INDEX idx_plan_changes_sub (subscription_id),
        INDEX idx_plan_changes_effective (effective_date, applied_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[OK] Tabela subscription_plan_changes pronta.");

    console.log("\n=== MIGRATION EXECUTADA COM SUCESSO! ===");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Erro ao executar migration:", err);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
