import db from "./db";
import crypto from "crypto";

export type SubscriptionState = "active" | "past_due" | "suspended" | "cancelled";

export interface TransitionContext {
  source: "mercado_pago" | "asaas" | "admin" | "system";
  gateway_event_id?: string | null;
  raw_payload?: any;
  event_timestamp?: Date | string | null;
  grace_period_days?: number;
  reason?: string;
}

// Transições de estado permitidas
const VALID_TRANSITIONS: Record<SubscriptionState, SubscriptionState[]> = {
  active: ["past_due", "cancelled"],
  past_due: ["active", "suspended", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: [], // Não permite transição direta de cancelada para ativa sem nova assinatura
};

/**
 * Função central AUTORIZADA para transicionar o estado de uma assinatura.
 * Valida a transição, atualiza a tabela subscriptions e grava o evento auditável em subscription_events.
 */
export async function transitionSubscriptionState(
  subscriptionId: string,
  newState: SubscriptionState,
  context: TransitionContext
): Promise<{ success: boolean; previousState: SubscriptionState; newState: SubscriptionState; message?: string }> {
  // 1. Buscar assinatura atual com lock de linha
  const subs = (await db.query(
    "SELECT * FROM subscriptions WHERE id = ? FOR UPDATE",
    [subscriptionId]
  )) as any[];

  if (!subs || subs.length === 0) {
    throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
  }

  const sub = subs[0];
  const currentState: SubscriptionState = (sub.status as SubscriptionState) || "suspended";

  // Se já estiver no mesmo estado, registrar e retornar sem erro
  if (currentState === newState) {
    return {
      success: true,
      previousState: currentState,
      newState,
      message: `Assinatura já se encontra no estado '${newState}'.`,
    };
  }

  // 2. Validar permissão da transição
  const allowedNextStates = VALID_TRANSITIONS[currentState] || [];
  if (!allowedNextStates.includes(newState)) {
    throw new Error(
      `Transição de estado inválida: de '${currentState}' para '${newState}'. Transições permitidas a partir de '${currentState}': [${allowedNextStates.join(", ")}]`
    );
  }

  // 3. Verificar ordenação temporal do evento (se fornecido timestamp de origem do gateway)
  if (context.event_timestamp) {
    const eventTime = new Date(context.event_timestamp).getTime();
    const lastEventRows = (await db.query(
      "SELECT created_at FROM subscription_events WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 1",
      [subscriptionId]
    )) as any[];

    if (lastEventRows.length > 0) {
      const lastTime = new Date(lastEventRows[0].created_at).getTime();
      if (eventTime < lastTime) {
        // Registrar evento recebido fora de ordem, mas NÃO aplicar a alteração de estado
        await db.query(
          `INSERT INTO subscription_events (
            id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id, raw_payload, created_at
          ) VALUES (?, ?, ?, 'out_of_order_event_ignored', ?, ?, ?, ?, ?, NOW())`,
          [
            crypto.randomUUID(),
            sub.tenant_id,
            subscriptionId,
            currentState,
            newState,
            context.source,
            context.gateway_event_id || null,
            JSON.stringify(context.raw_payload || {}),
          ]
        );

        return {
          success: false,
          previousState: currentState,
          newState: currentState,
          message: "Evento de webhook recebido fora de ordem (timestamp mais antigo). Estado mantido.",
        };
      }
    }
  }

  // 4. Calcular grace_period_ends_at se o novo estado for past_due
  let gracePeriodEndsAt: Date | null = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : null;
  if (newState === "past_due") {
    const days = context.grace_period_days ?? 3; // Grace period acordado de 3 dias
    gracePeriodEndsAt = new Date();
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + days);
  } else if (newState === "active") {
    gracePeriodEndsAt = null; // Limpa grace period quando ativada
  }

  // 5. Atualizar coluna de status no banco de dados (ÚNICO PONTO AUTORIZADO)
  await db.query(
    `UPDATE subscriptions
     SET status = ?, grace_period_ends_at = ?, updated_at = NOW()
     WHERE id = ?`,
    [newState, gracePeriodEndsAt, subscriptionId]
  );

  // 6. Registrar evento em subscription_events para histórico auditável e idempotência
  const eventId = crypto.randomUUID();
  await db.query(
    `INSERT INTO subscription_events (
      id, tenant_id, subscription_id, event_type, previous_status, new_status, source, gateway_event_id, raw_payload, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      eventId,
      sub.tenant_id,
      subscriptionId,
      `state_transition_${currentState}_to_${newState}`,
      currentState,
      newState,
      context.source,
      context.gateway_event_id || null,
      JSON.stringify(context.raw_payload || {}),
    ]
  );

  return {
    success: true,
    previousState: currentState,
    newState,
    message: `Transição concluída com sucesso: de '${currentState}' para '${newState}'.`,
  };
}

/**
 * Função utilitária para verificar idempotência de webhooks por gateway_event_id e source.
 */
export async function isGatewayEventProcessed(source: string, gatewayEventId: string): Promise<boolean> {
  if (!gatewayEventId) return false;
  const rows = (await db.query(
    "SELECT id FROM subscription_events WHERE source = ? AND gateway_event_id = ? LIMIT 1",
    [source, gatewayEventId]
  )) as any[];
  return rows.length > 0;
}

/**
 * Agenda a troca de plano para o PRÓXIMO ciclo de cobrança (sem alteração proporcional imediata).
 */
export async function schedulePlanChange(
  subscriptionId: string,
  newPlanId: string
): Promise<{ success: boolean; changeId: string; effectiveDate: Date; message: string }> {
  const { validatePlanExistence, resolveValidPlanId } = await import("./plan-validator");
  const check = await validatePlanExistence(newPlanId);

  if (!check.exists) {
    console.error("Invalid subscription plan", {
      subscription_id: subscriptionId,
      plan_id: newPlanId,
      operation: "schedulePlanChange",
    });
  }

  const validPlanId = await resolveValidPlanId(newPlanId, {
    subscriptionId,
    operation: "schedulePlanChange",
  });

  const subs = (await db.query(
    "SELECT id, tenant_id, plan_id, expires_at FROM subscriptions WHERE id = ? LIMIT 1",
    [subscriptionId]
  )) as any[];

  if (!subs || subs.length === 0) {
    throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
  }

  const sub = subs[0];
  const oldPlanId = sub.plan_id;
  const effectiveDate = new Date(sub.expires_at || Date.now());

  // Cancelar qualquer agendamento pendente anterior
  await db.query(
    "DELETE FROM subscription_plan_changes WHERE subscription_id = ? AND applied_at IS NULL",
    [subscriptionId]
  );

  const changeId = crypto.randomUUID();
  await db.query(
    `INSERT INTO subscription_plan_changes (
      id, tenant_id, subscription_id, old_plan, new_plan, effective_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [changeId, sub.tenant_id, subscriptionId, oldPlanId, validPlanId, effectiveDate]
  );

  return {
    success: true,
    changeId,
    effectiveDate,
    message: `Troca do plano '${oldPlanId}' para '${newPlanId}' agendada para o próximo ciclo em ${effectiveDate.toISOString()}.`,
  };
}

/**
 * Cancela uma troca de plano agendada pendente (caso o cliente se arrependa antes do próximo ciclo).
 */
export async function cancelScheduledPlanChange(
  subscriptionId: string
): Promise<{ success: boolean; message: string }> {
  const result = (await db.query(
    "DELETE FROM subscription_plan_changes WHERE subscription_id = ? AND applied_at IS NULL",
    [subscriptionId]
  )) as any;

  return {
    success: true,
    message: "Agendamento de troca de plano cancelado com sucesso.",
  };
}

