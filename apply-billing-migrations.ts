import db from "./src/lib/db";

async function run() {
  console.log("=== EXECUTANDO MIGRATIONS DE FATURAMENTO E VÍNCULO DE PLANOS ===");

  try {
    // 1. Criar coluna subscription_plan_id na tabela billing_plans se não existir
    const columns = await db.query(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'subscription_plan_id'`
    ) as any[];

    if (columns[0].cnt === 0) {
      console.log("Adicionando coluna 'subscription_plan_id' à tabela 'billing_plans'...");
      await db.query(`ALTER TABLE billing_plans ADD COLUMN subscription_plan_id VARCHAR(36) NULL`);
      await db.query(`ALTER TABLE billing_plans ADD INDEX idx_billing_plans_subscription_plan_id (subscription_plan_id)`);
    } else {
      console.log("Coluna 'subscription_plan_id' já existe em 'billing_plans'.");
    }

    // 2. Realizar backfill dos planos comerciais ligando-os aos IDs operacionais correspondentes
    console.log("Executando backfill de mapeamento de planos...");
    
    // Obter IDs reais dos slugs de planos operacionais
    const subPlans = await db.query("SELECT id, slug FROM subscription_plans") as any[];
    const basicPlan = subPlans.find(p => p.slug === "basic");
    const premiumPlan = subPlans.find(p => p.slug === "premium");

    if (!basicPlan || !premiumPlan) {
      throw new Error("Planos operacionais obrigatórios ('basic' ou 'premium') não encontrados no banco. Abortando migration.");
    }

    console.log(`Mapeamentos encontrados: 'basic' -> ${basicPlan.id}, 'premium' -> ${premiumPlan.id}`);

    // Update plans
    await db.query(
      "UPDATE billing_plans SET subscription_plan_id = ? WHERE id IN ('plan-mensal', 'plan-trimestral')",
      [basicPlan.id]
    );
    await db.query(
      "UPDATE billing_plans SET subscription_plan_id = ? WHERE id IN ('plan-semestral', 'plan-anual')",
      [premiumPlan.id]
    );
    console.log("Backfill de planos concluído com sucesso.");

    // 3. Adicionar constraint de chave estrangeira se não existir
    const constraints = await db.query(
      `SELECT COUNT(*) as cnt FROM information_schema.TABLE_CONSTRAINTS 
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_plans' AND CONSTRAINT_NAME = 'fk_billing_subscription_plan'`
    ) as any[];

    if (constraints[0].cnt === 0) {
      console.log("Adicionando Constraint FK 'fk_billing_subscription_plan'...");
      await db.query(`
        ALTER TABLE billing_plans
        ADD CONSTRAINT fk_billing_subscription_plan
        FOREIGN KEY (subscription_plan_id)
        REFERENCES subscription_plans(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
      `);
    } else {
      console.log("Constraint FK 'fk_billing_subscription_plan' já existe.");
    }

    // 4. Criar tabela billing_webhook_events se não existir
    console.log("Garantindo a criação da tabela billing_webhook_events...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS billing_webhook_events (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        environment ENUM('sandbox', 'production') NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255) NULL,
        request_id VARCHAR(255) NULL,

        tenant_id VARCHAR(36) NULL,
        invoice_id VARCHAR(36) NULL,
        payment_id VARCHAR(36) NULL,

        payload_hash VARCHAR(64) NULL,
        payload JSON NULL,

        status ENUM(
          'received',
          'processing',
          'processed',
          'ignored',
          'failed'
        ) NOT NULL DEFAULT 'received',

        attempts INT NOT NULL DEFAULT 0,
        error_code VARCHAR(100) NULL,
        error_message TEXT NULL,

        provider_created_at DATETIME NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processing_started_at DATETIME NULL,
        processed_at DATETIME NULL,

        UNIQUE KEY uq_billing_webhook_event (
          provider,
          environment,
          event_id
        ),

        KEY idx_billing_webhook_status (
          status,
          received_at
        ),

        KEY idx_billing_webhook_resource (
          provider,
          resource_id
        )
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Tabela billing_webhook_events criada/confirmada com sucesso.");

    console.log("=== MIGRATIONS CONCLUÍDAS COM SUCESSO! ===");
  } catch (err: any) {
    console.error("Erro ao aplicar migrations:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

run().catch(console.error);
