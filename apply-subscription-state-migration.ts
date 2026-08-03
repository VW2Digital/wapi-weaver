import db from "./src/lib/db";

async function runMigration() {
  console.log("=== INICIANDO MIGRATION DA MÁQUINA DE ESTADOS DE ASSINATURAS ===");

  try {
    // 1. Garantir que a tabela subscriptions existe
    await db.query(`
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

    // 2. Adicionar payment_provider caso não exista
    const columns = (await db.query("SHOW COLUMNS FROM subscriptions")) as any[];
    const colNames = columns.map((c: any) => c.Field);

    if (!colNames.includes("payment_provider")) {
      console.log("Adicionando coluna payment_provider na tabela subscriptions...");
      await db.query("ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(32) DEFAULT 'mercado_pago'");
    }

    if (!colNames.includes("grace_period_ends_at")) {
      console.log("Adicionando coluna grace_period_ends_at na tabela subscriptions...");
      await db.query("ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at DATETIME NULL");
    }

    // 3. Atualizar status existentes para o novo enum estrito ('active', 'past_due', 'suspended', 'cancelled')
    console.log("Mapeando status antigos para a nova máquina de estados...");
    await db.query("UPDATE subscriptions SET status = 'active' WHERE status IN ('trial', 'expiring')");
    await db.query("UPDATE subscriptions SET status = 'suspended' WHERE status = 'expired'");

    // 4. Criar tabela subscription_events se não existir
    console.log("Criando tabela subscription_events...");
    await db.query(`
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

    // 5. Criar tabela subscription_plan_changes se não existir
    console.log("Criando tabela subscription_plan_changes...");
    await db.query(`
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

    console.log("=== MIGRATION CONCLUÍDA COM SUCESSO! ===");
    process.exit(0);
  } catch (err: any) {
    console.error("Erro ao executar migration:", err);
    process.exit(1);
  }
}

runMigration();
