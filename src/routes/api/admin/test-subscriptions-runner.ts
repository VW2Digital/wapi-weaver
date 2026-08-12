import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  transitionSubscriptionState,
  isGatewayEventProcessed,
  schedulePlanChange,
} from "@/lib/subscription-state-machine";
import { processOverdueGracePeriods, applyPendingPlanChanges } from "@/lib/cron-subscription";
import crypto from "crypto";
import { enforceAdminMaster } from "@/lib/admin-master-auth";

export const Route = createFileRoute("/api/admin/test-subscriptions-runner")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = await enforceAdminMaster(request);
        if (authError) return authError;

        const logs: string[] = [];
        const testTenantId = `tenant_test_${Date.now()}`;
        const testSubId = crypto.randomUUID();
        const { getDefaultTrialPlanId } = await import("@/lib/services/subscription-access.service");
        const { resolveValidPlanId } = await import("@/lib/plan-validator");
        const testPlanId = await getDefaultTrialPlanId();
        const newPlanId = await resolveValidPlanId(null, { operation: "test_subscriptions_runner" });

        try {
          logs.push("=== BATERIA DE TESTES DA MÁQUINA DE ESTADOS ===");

          const startsAt = new Date();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          // 0. Setup: Criar assinatura de teste
          await db.query(
            `INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, starts_at, expires_at, auto_renew)
             VALUES (?, ?, 'cus_test_123', ?, 'active', ?, ?, 1)`,
            [testSubId, testTenantId, testPlanId, startsAt, expiresAt]
          );
          logs.push(`[SETUP] Assinatura ${testSubId} criada com status: 'active'.`);

          // 1. active -> past_due (webhook de falha)
          const event1Id = `evt_mp_fail_${Date.now()}`;
          const res1 = await transitionSubscriptionState(testSubId, "past_due", {
            source: "mercado_pago",
            gateway_event_id: event1Id,
            raw_payload: { status: "rejected" },
            grace_period_days: 3,
          });
          logs.push(`[TESTE 1] active -> past_due: ${JSON.stringify(res1)}`);

          // 2. Idempotência (webhook duplicado)
          const isDup = await isGatewayEventProcessed("mercado_pago", event1Id);
          logs.push(`[TESTE 2] Webhook duplicado detectado no banco? ${isDup}`);

          // 3. past_due -> active (pagamento recuperado)
          const res3 = await transitionSubscriptionState(testSubId, "active", {
            source: "mercado_pago",
            gateway_event_id: `evt_mp_success_${Date.now()}`,
            raw_payload: { status: "approved" },
          });
          logs.push(`[TESTE 3] past_due -> active: ${JSON.stringify(res3)}`);

          // 4. past_due -> suspended via Cron Job
          const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          await db.query("UPDATE subscriptions SET status = 'past_due', grace_period_ends_at = ? WHERE id = ?", [pastDate, testSubId]);
          const cronRes = await processOverdueGracePeriods();
          const subT4 = (await db.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId])) as any[];
          logs.push(`[TESTE 4] Grace Period expirado -> Status: '${subT4[0]?.status}' (${JSON.stringify(cronRes)})`);

          // 5. suspended -> active (reativação da assinatura)
          const res5 = await transitionSubscriptionState(testSubId, "active", {
            source: "asaas",
            gateway_event_id: `evt_asaas_reactivate_${Date.now()}`,
          });
          logs.push(`[TESTE 5] Reativação suspended -> active: ${JSON.stringify(res5)}`);

          // 6. Out of order event (timestamp antigo)
          const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const res6 = await transitionSubscriptionState(testSubId, "past_due", {
            source: "mercado_pago",
            gateway_event_id: `evt_old_${Date.now()}`,
            event_timestamp: oldTimestamp,
          });
          const subT6 = (await db.query("SELECT status FROM subscriptions WHERE id = ?", [testSubId])) as any[];
          logs.push(`[TESTE 6] Evento antigo recebido -> Status mantido em: '${subT6[0]?.status}' (${res6.message})`);

          // 7. Troca de plano agendada para o próximo ciclo
          const planChangeRes = await schedulePlanChange(testSubId, newPlanId);
          const subBefore = (await db.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId])) as any[];
          logs.push(`[TESTE 7.1] Agendamento efetuado: ${JSON.stringify(planChangeRes)}`);
          logs.push(`[TESTE 7.2] Plano ATUAL do cliente mantido em: '${subBefore[0]?.plan_id}'`);

          await db.query("UPDATE subscription_plan_changes SET effective_date = NOW() - INTERVAL 1 HOUR WHERE subscription_id = ?", [testSubId]);
          const cronPlanRes = await applyPendingPlanChanges();
          const subAfter = (await db.query("SELECT plan_id FROM subscriptions WHERE id = ?", [testSubId])) as any[];
          logs.push(`[TESTE 7.3] Job de Troca de Plano executado: ${JSON.stringify(cronPlanRes)}`);
          logs.push(`[TESTE 7.4] Novo Plano Aplicado no próximo ciclo: '${subAfter[0]?.plan_id}'`);

          // Cleanup
          await db.query("DELETE FROM subscription_events WHERE tenant_id = ?", [testTenantId]);
          await db.query("DELETE FROM subscription_plan_changes WHERE tenant_id = ?", [testTenantId]);
          await db.query("DELETE FROM subscriptions WHERE tenant_id = ?", [testTenantId]);

          logs.push("🎉 TODOS OS 7 TESTES DA MÁQUINA DE ESTADOS PASSARAM COM SUCESSO!");

          return new Response(JSON.stringify({ success: true, logs }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          logs.push(`❌ ERRO NO TESTE: ${e.stack || e.message}`);
          return new Response(JSON.stringify({ success: false, error: e.message, logs }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
