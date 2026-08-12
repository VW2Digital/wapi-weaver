import db from "./db";
import { transitionSubscriptionState } from "./subscription-state-machine";

/**
 * Job agendado (Cron) para verificar e expirar assinaturas em atraso (past_due).
 * Quando grace_period_ends_at for menor ou igual à data atual, transiciona para 'suspended'.
 */
export async function processOverdueGracePeriods(): Promise<{ processedCount: number; suspendedIds: string[] }> {
  console.log("[Cron Subscriptions] Verificando grace periods expirados...");

  // Buscar assinaturas em past_due que o prazo de tolerância venceu
  const overdueSubs = (await db.query(
    `SELECT id, tenant_id, status, grace_period_ends_at
     FROM subscriptions
     WHERE status = 'past_due' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at <= NOW()`
  )) as any[];

  const suspendedIds: string[] = [];

  for (const sub of overdueSubs) {
    try {
      const res = await transitionSubscriptionState(sub.id, "suspended", {
        source: "system",
        reason: "Grace period de 3 dias expirado sem confirmação de pagamento.",
      });
      if (res.success) {
        suspendedIds.push(sub.id);
      }
    } catch (e: any) {
      console.error(`[Cron Subscriptions] Erro ao suspender assinatura ${sub.id}:`, e.message);
    }
  }

  console.log(`[Cron Subscriptions] Processamento concluído. ${suspendedIds.length} assinaturas suspensas.`);
  return { processedCount: suspendedIds.length, suspendedIds };
}

/**
 * Job agendado (Cron) para aplicar trocas de plano agendadas para o próximo ciclo de cobrança.
 */
export async function applyPendingPlanChanges(): Promise<{ appliedCount: number; appliedIds: string[] }> {
  console.log("[Cron Subscriptions] Verificando trocas de plano agendadas pendentes...");

  const pendingChanges = (await db.query(
    `SELECT * FROM subscription_plan_changes
     WHERE applied_at IS NULL AND effective_date <= NOW()`
  )) as any[];

  const appliedIds: string[] = [];

  for (const change of pendingChanges) {
    try {
      const { resolveValidPlanId } = await import("./plan-validator");
      const targetPlanId = await resolveValidPlanId(change.new_plan, {
        tenantId: change.tenant_id,
        subscriptionId: change.subscription_id,
        operation: "applyPendingPlanChanges",
        source: "cron_subscription",
      });

      await db.transaction(async (conn) => {
        // 1. Atualizar o plan_id na assinatura com ID validado
        await conn.query(
          "UPDATE subscriptions SET plan_id = ?, updated_at = NOW() WHERE id = ?",
          [targetPlanId, change.subscription_id]
        );

        // 2. Marcar a mudança de plano como aplicada
        await conn.query(
          "UPDATE subscription_plan_changes SET applied_at = NOW() WHERE id = ?",
          [change.id]
        );

        // 3. Registrar o evento no histórico de auditoria
        await conn.query(
          `INSERT INTO subscription_events (
            id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload, created_at
          ) VALUES (UUID(), ?, ?, 'scheduled_plan_change_applied', NULL, NULL, 'system', ?, NOW())`,
          [
            change.tenant_id,
            change.subscription_id,
            JSON.stringify({ old_plan: change.old_plan, new_plan: change.new_plan }),
          ]
        );
      });
      appliedIds.push(change.id);
    } catch (e: any) {
      console.error(`[Cron Subscriptions] Erro ao aplicar troca de plano ${change.id}:`, e.message);
    }
  }

  console.log(`[Cron Subscriptions] Trocas de plano concluídas. ${appliedIds.length} alterações aplicadas.`);
  return { appliedCount: appliedIds.length, appliedIds };
}
