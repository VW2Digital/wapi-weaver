import db from "@/lib/db";

export interface PlanValidationResult {
  exists: boolean;
  isActive: boolean;
  plan: any | null;
  table: "billing_plans" | "subscription_plans" | null;
}

export interface PlanContextInfo {
  userId?: string;
  tenantId?: string;
  subscriptionId?: string;
  paymentId?: string;
  operation?: string;
  source?: string;
}

/**
 * Normaliza a execução de query para suportar tanto a instância do `db` wrapper quanto conexões MySQL brutas.
 */
async function executeQuery(conn: any, sql: string, params: any[]): Promise<any[]> {
  const target = conn || db;
  let rows: any;
  if (target.execute) {
    rows = await target.execute(sql, params);
  } else {
    rows = await target.query(sql, params);
  }

  // Desestruturar tupla do mysql2 se necessário [rows, fields]
  if (Array.isArray(rows) && rows.length === 2 && Array.isArray(rows[1])) {
    return Array.isArray(rows[0]) ? rows[0] : [];
  }
  return Array.isArray(rows) ? rows : [];
}

/**
 * Verifica se um `plan_id` existe na tabela `billing_plans` ou `subscription_plans`.
 */
export async function validatePlanExistence(
  planId: string | null | undefined,
  conn?: any
): Promise<PlanValidationResult> {
  if (!planId) {
    return { exists: false, isActive: false, plan: null, table: null };
  }

  // 1. Buscar primeiro em billing_plans (tabela primária de planos comerciais)
  const billingRows = await executeQuery(conn, "SELECT * FROM billing_plans WHERE id = ? LIMIT 1", [planId]);
  if (billingRows.length > 0) {
    const plan = billingRows[0];
    return {
      exists: true,
      isActive: Boolean(plan.is_active),
      plan,
      table: "billing_plans",
    };
  }

  // 2. Buscar em subscription_plans (tabela de planos operacionais/técnicos)
  const subPlanRows = await executeQuery(conn, "SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
  if (subPlanRows.length > 0) {
    const plan = subPlanRows[0];
    return {
      exists: true,
      isActive: Boolean(plan.is_active),
      plan,
      table: "subscription_plans",
    };
  }

  return { exists: false, isActive: false, plan: null, table: null };
}

/**
 * Garante e resolve um `plan_id` válido no banco de dados.
 * Se o `plan_id` fornecido não existir (por ter sido excluído no passado ou id legado),
 * resolve dinamicamente um plano ativo válido e registra log de aviso.
 */
export async function resolveValidPlanId(
  requestedPlanId: string | null | undefined,
  context?: PlanContextInfo,
  conn?: any
): Promise<string> {
  const check = await validatePlanExistence(requestedPlanId, conn);

  if (check.exists && requestedPlanId) {
    return requestedPlanId;
  }

  // Log de diagnóstico sobre plan_id inexistente/obsoleto
  console.warn("[Plan Validator] Direct plan_id lookup failed or missing. Reconciling fallback active plan.", {
    requested_plan_id: requestedPlanId,
    user_id: context?.userId || context?.tenantId || "system",
    subscription_id: context?.subscriptionId || "N/A",
    operation: context?.operation || "plan_resolution",
  });

  // Buscar plano comercial ativo padrão
  const activeBilling = await executeQuery(
    conn,
    "SELECT id FROM billing_plans WHERE is_active = true ORDER BY sort_order ASC, created_at ASC LIMIT 1",
    []
  );
  if (activeBilling.length > 0) {
    return activeBilling[0].id;
  }

  // Buscar plano operacional ativo padrão como segundo fallback
  const activeSubPlan = await executeQuery(
    conn,
    "SELECT id FROM subscription_plans WHERE is_active = true ORDER BY created_at ASC LIMIT 1",
    []
  );
  if (activeSubPlan.length > 0) {
    return activeSubPlan[0].id;
  }

  // Fallback extremo resiliente
  return requestedPlanId || "plan-mensal";
}

/**
 * Valida a existência do plano e, caso não exista, retorna uma resposta HTTP 400 tratada
 * impedindo que o erro de Foreign Key ocorra ou chegue ao usuário.
 */
export async function validateOrRejectPlan(
  planId: string | null | undefined,
  context: PlanContextInfo,
  conn?: any
): Promise<{ valid: boolean; response?: Response; planResult?: PlanValidationResult }> {
  const check = await validatePlanExistence(planId, conn);

  if (check.exists) {
    if (!check.isActive) {
      console.warn("[Plan Validator] Selected plan is inactive", {
        plan_id: planId,
        user_id: context.userId || context.tenantId,
        operation: context.operation,
      });
      return {
        valid: false,
        response: new Response(
          JSON.stringify({
            success: false,
            message: "O plano selecionado está inativo no momento. Selecione outro plano.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        ),
        planResult: check,
      };
    }

    return { valid: true, planResult: check };
  }

  // Registrar log de erro de diagnóstico padronizado
  console.error("Invalid subscription plan", {
    user_id: context.userId || context.tenantId || "unknown",
    plan_id: planId,
    payment_id: context.paymentId || null,
    subscription_id: context.subscriptionId || null,
    operation: context.operation || "unknown",
    source: context.source || "unknown",
  });

  return {
    valid: false,
    response: new Response(
      JSON.stringify({
        success: false,
        message: "O plano selecionado não está mais disponível. Selecione um plano novamente.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    ),
    planResult: check,
  };
}
