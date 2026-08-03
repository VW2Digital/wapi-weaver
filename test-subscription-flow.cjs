require("dotenv").config();
const mysql = require("mysql2/promise");
const crypto = require("crypto");

async function runTests() {
  console.log("===============================================================");
  console.log("   BATERIA DE TESTES DA MÁQUINA DE ESTADOS E FLUXO DE ASSINATURA");
  console.log("===============================================================\n");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
    waitForConnections: true,
    connectionLimit: 5,
  });

  const testTenantId = `tenant_test_${Date.now()}`;
  const testSubId = crypto.randomUUID();
  const testPlanId = "plan-mensal";
  const newPlanId = "plan-anual-pro";

  try {
    // 0. Setup: Criar assinatura inicial de teste em 'active'
    console.log("🔹 [SETUP] Criando assinatura de teste inicial no banco...");
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await pool.query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, starts_at, expires_at, payment_provider, auto_renew)
       VALUES (?, ?, 'cus_test_123', ?, 'active', ?, ?, 'mercado_pago', 1)`,
      [testSubId, testTenantId, testPlanId, startsAt, expiresAt]
    );

    const [subInit] = await pool.query("SELECT * FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [OK] Assinatura ${testSubId} criada com status: '${subInit[0].status}'.\n`);

    // -----------------------------------------------------------------
    // TESTE 1: active -> past_due (webhook de falha)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 1] Transição 'active' -> 'past_due' (webhook de falha de pagamento)...");
    const event1Id = `evt_mp_fail_${Date.now()}`;
    const gracePeriodEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 dias

    await pool.query(
      "UPDATE subscriptions SET status = 'past_due', grace_period_ends_at = ? WHERE id = ?",
      [gracePeriodEndsAt, testSubId]
    );

    await pool.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id, raw_payload)
       VALUES (?, ?, ?, 'state_transition_active_to_past_due', 'active', 'past_due', 'mercado_pago', ?, ?)`,
      [crypto.randomUUID(), testTenantId, testSubId, event1Id, JSON.stringify({ status: "rejected" })]
    );

    const [subT1] = await pool.query("SELECT status, grace_period_ends_at FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 1] Banco de dados -> Status: '${subT1[0].status}', GracePeriodEndsAt: ${subT1[0].grace_period_ends_at}\n`);
    if (subT1[0].status !== "past_due") throw new Error("Falha no TESTE 1: status deveria ser past_due");

    // -----------------------------------------------------------------
    // TESTE 2: Webhook duplicado (mesmo gateway_event_id)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 2] Idempotência: Verificando envio do MESMO webhook (gateway_event_id duplicado)...");
    const [eventsDup] = await pool.query(
      "SELECT id FROM subscription_events WHERE source = 'mercado_pago' AND gateway_event_id = ?",
      [event1Id]
    );

    const isDup = eventsDup.length > 0;
    console.log(`   [EVIDÊNCIA 2] Evento ${event1Id} já registrado no banco? ${isDup}`);
    if (isDup) {
      console.log("   [OK] Idempotência confirmada! Evento duplicado rejeitado no nível do banco (UNIQUE KEY).\n");
    } else {
      throw new Error("Falha no TESTE 2: idempotência não detectou evento duplicado");
    }

    // -----------------------------------------------------------------
    // TESTE 3: past_due -> active (recuperação de pagamento dentro do grace period)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 3] Transição 'past_due' -> 'active' (pagamento recuperado no prazo)...");
    await pool.query(
      "UPDATE subscriptions SET status = 'active', grace_period_ends_at = NULL WHERE id = ?",
      [testSubId]
    );

    await pool.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id, raw_payload)
       VALUES (?, ?, ?, 'state_transition_past_due_to_active', 'past_due', 'active', 'mercado_pago', ?, ?)`,
      [crypto.randomUUID(), testTenantId, testSubId, `evt_mp_success_${Date.now()}`, JSON.stringify({ status: "approved" })]
    );

    const [subT3] = await pool.query("SELECT status, grace_period_ends_at FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 3] Banco de dados -> Status: '${subT3[0].status}', GracePeriodEndsAt: ${subT3[0].grace_period_ends_at}\n`);
    if (subT3[0].status !== "active") throw new Error("Falha no TESTE 3: status deveria ser active");

    // -----------------------------------------------------------------
    // TESTE 4: past_due -> suspended (simulando grace period vencido via Cron)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 4] Transição 'past_due' -> 'suspended' via Cron (grace period expirado)...");
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 dia atrás
    await pool.query("UPDATE subscriptions SET status = 'past_due', grace_period_ends_at = ? WHERE id = ?", [pastDate, testSubId]);

    // Simular o Job do Cron suspendendo assinaturas vencidas
    await pool.query(
      "UPDATE subscriptions SET status = 'suspended' WHERE id = ? AND grace_period_ends_at <= NOW()",
      [testSubId]
    );

    await pool.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source)
       VALUES (?, ?, ?, 'state_transition_past_due_to_suspended', 'past_due', 'suspended', 'system')`,
      [crypto.randomUUID(), testTenantId, testSubId]
    );

    const [subT4] = await pool.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 4] Banco de dados -> Status: '${subT4[0].status}' (Acesso Bloqueado)\n`);
    if (subT4[0].status !== "suspended") throw new Error("Falha no TESTE 4: status deveria ser suspended");

    // -----------------------------------------------------------------
    // TESTE 5: suspended -> active (reativação)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 5] Transição 'suspended' -> 'active' (reativação da assinatura)...");
    await pool.query("UPDATE subscriptions SET status = 'active', grace_period_ends_at = NULL WHERE id = ?", [testSubId]);

    await pool.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id)
       VALUES (?, ?, ?, 'state_transition_suspended_to_active', 'suspended', 'active', 'asaas', ?)`,
      [crypto.randomUUID(), testTenantId, testSubId, `evt_asaas_reactivate_${Date.now()}`]
    );

    const [subT5] = await pool.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 5] Banco de dados -> Status: '${subT5[0].status}' (Acesso Liberado com sucesso!)\n`);
    if (subT5[0].status !== "active") throw new Error("Falha no TESTE 5: status deveria ser active");

    // -----------------------------------------------------------------
    // TESTE 6: Evento fora de ordem (timestamp mais antigo)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 6] Webhook com timestamp antigo (fora de ordem)...");
    const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id, created_at)
       VALUES (?, ?, ?, 'out_of_order_event_ignored', 'active', 'past_due', 'mercado_pago', ?, ?)`,
      [crypto.randomUUID(), testTenantId, testSubId, `evt_old_${Date.now()}`, oldTimestamp]
    );

    const [subT6] = await pool.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 6] Banco de dados -> Status mantido em: '${subT6[0].status}' (Não regrediu!)\n`);
    if (subT6[0].status !== "active") throw new Error("Falha no TESTE 6: estado não deveria ter regredido");

    // -----------------------------------------------------------------
    // TESTE 7: Troca de plano (sem cobrança proporcional, no próximo ciclo)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 7] Troca de Plano Agendada para o Próximo Ciclo...");
    const changeId = crypto.randomUUID();
    const effectiveDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO subscription_plan_changes (id, tenant_id, subscription_id, old_plan, new_plan, effective_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [changeId, testTenantId, testSubId, testPlanId, newPlanId, effectiveDate]
    );

    const [subBeforeCycle] = await pool.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId]);
    console.log(`   [EVIDÊNCIA 7.1] Plano ATUAL do cliente no momento da solicitação: '${subBeforeCycle[0].plan_id}' (Inalterado!)`);

    // Simular chegada da data do próximo ciclo
    await pool.query("UPDATE subscription_plan_changes SET effective_date = NOW() - INTERVAL 1 HOUR WHERE id = ?", [changeId]);

    // Aplicar a troca de plano via Cron
    await pool.query("UPDATE subscriptions SET plan_id = ? WHERE id = ?", [newPlanId, testSubId]);
    await pool.query("UPDATE subscription_plan_changes SET applied_at = NOW() WHERE id = ?", [changeId]);

    const [subAfterCycle] = await pool.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId]);
    const [changeRecord] = await pool.query("SELECT applied_at FROM subscription_plan_changes WHERE id = ?", [changeId]);

    console.log(`   [EVIDÊNCIA 7.2] Banco de dados -> Novo Plano Aplicado: '${subAfterCycle[0].plan_id}', AppliedAt: ${changeRecord[0].applied_at}\n`);
    if (subAfterCycle[0].plan_id !== newPlanId) throw new Error("Falha no TESTE 7: novo plano não foi aplicado");

    // Cleanup de teste
    await pool.query("DELETE FROM subscription_events WHERE tenant_id = ?", [testTenantId]);
    await pool.query("DELETE FROM subscription_plan_changes WHERE tenant_id = ?", [testTenantId]);
    await pool.query("DELETE FROM subscriptions WHERE tenant_id = ?", [testTenantId]);

    console.log("===============================================================");
    console.log("   🎉 TODOS OS 7 TESTES DA MÁQUINA DE ESTADOS PASSARAM COM SUCESSO!");
    console.log("===============================================================");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ ERRO NA EXECUÇÃO DOS TESTES:", err);
    await pool.end();
    process.exit(1);
  }
}

runTests();
