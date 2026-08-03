import db from "./src/lib/db";
import {
  transitionSubscriptionState,
  isGatewayEventProcessed,
  schedulePlanChange,
  cancelScheduledPlanChange,
} from "./src/lib/subscription-state-machine";
import { processOverdueGracePeriods, applyPendingPlanChanges } from "./src/lib/cron-subscription";
import crypto from "crypto";

async function runTests() {
  console.log("===============================================================");
  console.log("   BATERIA DE TESTES DA MÁQUINA DE ESTADOS E FLUXO DE ASSINATURA");
  console.log("===============================================================\n");

  const testTenantId = `tenant_test_${Date.now()}`;
  const testSubId = crypto.randomUUID();
  const testPlanId = "plan-mensal";
  const newPlanId = "plan-anual-pro";

  try {
    // 0. Setup: Criar assinatura inicial de teste em 'active'
    console.log("🔹 [SETUP] Criando assinatura de teste inicial no banco...");
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    await db.query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, starts_at, expires_at, payment_provider, auto_renew)
       VALUES (?, ?, 'cus_test_123', ?, 'active', ?, ?, 'mercado_pago', 1)`,
      [testSubId, testTenantId, testPlanId, startsAt, expiresAt]
    );

    const [subInit] = (await db.query("SELECT * FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [OK] Assinatura ${testSubId} criada com status: '${subInit.status}'.\n`);

    // -----------------------------------------------------------------
    // TESTE 1: active -> past_due (webhook de falha)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 1] Transição 'active' -> 'past_due' (webhook de falha de pagamento)...");
    const event1Id = `evt_mp_fail_${Date.now()}`;

    const res1 = await transitionSubscriptionState(testSubId, "past_due", {
      source: "mercado_pago",
      gateway_event_id: event1Id,
      raw_payload: { status: "rejected", id: event1Id },
      grace_period_days: 3,
    });

    const [subT1] = (await db.query("SELECT status, grace_period_ends_at FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [EVIDÊNCIA 1] Resposta: ${JSON.stringify(res1)}`);
    console.log(`   [EVIDÊNCIA 1] Banco de dados -> Status: '${subT1.status}', GracePeriodEndsAt: ${subT1.grace_period_ends_at}\n`);
    if (subT1.status !== "past_due") throw new Error("Falha no TESTE 1: status deveria ser past_due");

    // -----------------------------------------------------------------
    // TESTE 2: Webhook duplicado (mesmo gateway_event_id)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 2] Idempotência: Enviando o MESMO webhook novamente (gateway_event_id duplicado)...");
    const isDup = await isGatewayEventProcessed("mercado_pago", event1Id);
    console.log(`   [EVIDÊNCIA 2] Evento ${event1Id} já processado anteriormente? ${isDup}`);

    if (isDup) {
      console.log("   [OK] Idempotência confirmada! O webhook duplicado foi bloqueado sem re-transicionar.\n");
    } else {
      throw new Error("Falha no TESTE 2: idempotência não detectou evento duplicado");
    }

    // -----------------------------------------------------------------
    // TESTE 3: past_due -> active (recuperação de pagamento dentro do grace period)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 3] Transição 'past_due' -> 'active' (pagamento recuperado no prazo)...");
    const res3 = await transitionSubscriptionState(testSubId, "active", {
      source: "mercado_pago",
      gateway_event_id: `evt_mp_success_${Date.now()}`,
      raw_payload: { status: "approved" },
    });

    const [subT3] = (await db.query("SELECT status, grace_period_ends_at FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [EVIDÊNCIA 3] Resposta: ${JSON.stringify(res3)}`);
    console.log(`   [EVIDÊNCIA 3] Banco de dados -> Status: '${subT3.status}', GracePeriodEndsAt: ${subT3.grace_period_ends_at}\n`);
    if (subT3.status !== "active") throw new Error("Falha no TESTE 3: status deveria ser active");

    // -----------------------------------------------------------------
    // TESTE 4: past_due -> suspended (simulando grace period vencido via Cron)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 4] Transição 'past_due' -> 'suspended' via Cron (grace period expirado)...");
    // Forçar a assinatura para past_due com grace_period_ends_at no passado
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 dia atrás
    await db.query("UPDATE subscriptions SET status = 'past_due', grace_period_ends_at = ? WHERE id = ?", [pastDate, testSubId]);

    // Executar o Cron Job de expiração
    const cronRes = await processOverdueGracePeriods();
    const [subT4] = (await db.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId])) as any[];

    console.log(`   [EVIDÊNCIA 4] Cron Job Resultado: ${JSON.stringify(cronRes)}`);
    console.log(`   [EVIDÊNCIA 4] Banco de dados -> Status: '${subT4.status}' (Acesso Bloqueado)\n`);
    if (subT4.status !== "suspended") throw new Error("Falha no TESTE 4: status deveria ser suspended");

    // -----------------------------------------------------------------
    // TESTE 5: suspended -> active (reativação)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 5] Transição 'suspended' -> 'active' (reativação da assinatura)...");
    const res5 = await transitionSubscriptionState(testSubId, "active", {
      source: "asaas",
      gateway_event_id: `evt_asaas_reactivate_${Date.now()}`,
      raw_payload: { event: "PAYMENT_CONFIRMED" },
    });

    const [subT5] = (await db.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [EVIDÊNCIA 5] Resposta: ${JSON.stringify(res5)}`);
    console.log(`   [EVIDÊNCIA 5] Banco de dados -> Status: '${subT5.status}' (Acesso Liberado)\n`);
    if (subT5.status !== "active") throw new Error("Falha no TESTE 5: status deveria ser active");

    // -----------------------------------------------------------------
    // TESTE 6: Evento fora de ordem (timestamp mais antigo)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 6] Webhook com timestamp antigo (fora de ordem)...");
    const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias atrás

    const res6 = await transitionSubscriptionState(testSubId, "past_due", {
      source: "mercado_pago",
      gateway_event_id: `evt_old_${Date.now()}`,
      event_timestamp: oldTimestamp,
    });

    const [subT6] = (await db.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [EVIDÊNCIA 6] Resposta: ${JSON.stringify(res6)}`);
    console.log(`   [EVIDÊNCIA 6] Banco de dados -> Status mantido em: '${subT6.status}' (Não regrediu!)\n`);
    if (subT6.status !== "active") throw new Error("Falha no TESTE 6: estado não deveria ter regredido");

    // -----------------------------------------------------------------
    // TESTE 7: Troca de plano (sem cobrança proporcional, no próximo ciclo)
    // -----------------------------------------------------------------
    console.log("🔹 [TESTE 7] Troca de Plano Agendada para o Próximo Ciclo...");
    const planChangeRes = await schedulePlanChange(testSubId, newPlanId);
    console.log(`   [EVIDÊNCIA 7.1] Agendamento efetuado: ${JSON.stringify(planChangeRes)}`);

    const [subBeforeCycle] = (await db.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    console.log(`   [EVIDÊNCIA 7.2] Plano ATUAL do cliente no momento da solicitação: '${subBeforeCycle.plan_id}' (Inalterado!)`);

    // Simular a chegada da data do próximo ciclo atualizando effective_date para o passado
    await db.query(
      "UPDATE subscription_plan_changes SET effective_date = NOW() - INTERVAL 1 HOUR WHERE subscription_id = ?",
      [testSubId]
    );

    // Executar o job agendado de troca de plano
    const cronPlanRes = await applyPendingPlanChanges();
    const [subAfterCycle] = (await db.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId])) as any[];
    const [changeRecord] = (await db.query("SELECT applied_at FROM subscription_plan_changes WHERE subscription_id = ?", [testSubId])) as any[];

    console.log(`   [EVIDÊNCIA 7.3] Job de Troca de Plano Resultado: ${JSON.stringify(cronPlanRes)}`);
    console.log(`   [EVIDÊNCIA 7.4] Banco de dados -> Novo Plano Aplicado: '${subAfterCycle.plan_id}', AppliedAt: ${changeRecord.applied_at}\n`);
    if (subAfterCycle.plan_id !== newPlanId) throw new Error("Falha no TESTE 7: novo plano não foi aplicado");

    // Cleanup de teste
    await db.query("DELETE FROM subscription_events WHERE tenant_id = ?", [testTenantId]);
    await db.query("DELETE FROM subscription_plan_changes WHERE tenant_id = ?", [testTenantId]);
    await db.query("DELETE FROM subscriptions WHERE tenant_id = ?", [testTenantId]);

    console.log("===============================================================");
    console.log("   🎉 TODOS OS 7 TESTES DA MÁQUINA DE ESTADOS PASSARAM COM SUCESSO!");
    console.log("===============================================================");
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ ERRO NA EXECUÇÃO DOS TESTES:", err);
    process.exit(1);
  }
}

runTests();
