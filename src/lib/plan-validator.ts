import db from "@/lib/db";

export interface SubscriptionPlanValidationResult {
  exists: boolean;
  isActive: boolean;
  plan: any | null;
}

export interface BillingPlanValidationResult {
  exists: boolean;
  isActive: boolean;
  billingPlan: any | null;
  subscriptionPlanId: string | null;
  subscriptionPlanValid: boolean;
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
 * Normalizes query execution to support both db wrapper and raw MySQL connections.
 */
async function executeQuery(conn: any, sql: string, params: any[]): Promise<any[]> {
  const target = conn || db;
  let rows: any;
  if (target.execute) {
    rows = await target.execute(sql, params);
  } else {
    rows = await target.query(sql, params);
  }

  if (Array.isArray(rows) && rows.length === 2 && Array.isArray(rows[1])) {
    return Array.isArray(rows[0]) ? rows[0] : [];
  }
  return Array.isArray(rows) ? rows : [];
}

/**
 * Validates plan_id strictly against `subscription_plans` (operational access plan).
 * MUST be used for subscriptions.plan_id validation.
 */
export async function validateSubscriptionPlan(
  planId: string | null | undefined,
  conn?: any
): Promise<SubscriptionPlanValidationResult> {
  if (!planId) {
    return { exists: false, isActive: false, plan: null };
  }

  const rows = await executeQuery(conn, "SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
  if (rows.length > 0) {
    const plan = rows[0];
    return {
      exists: true,
      isActive: Boolean(plan.is_active),
      plan,
    };
  }

  return { exists: false, isActive: false, plan: null };
}

/**
 * Validates billingPlanId strictly against `billing_plans` joined with `subscription_plans`.
 * MUST be used for checkout and billing_invoices.plan_id validation.
 */
export async function validateBillingPlan(
  billingPlanId: string | null | undefined,
  conn?: any
): Promise<BillingPlanValidationResult> {
  if (!billingPlanId) {
    return { exists: false, isActive: false, billingPlan: null, subscriptionPlanId: null, subscriptionPlanValid: false };
  }

  const rows = await executeQuery(
    conn,
    `SELECT bp.*, 
            sp.id AS sp_id, 
            sp.name AS sp_name, 
            sp.is_active AS sp_is_active 
     FROM billing_plans bp 
     LEFT JOIN subscription_plans sp ON sp.id = bp.subscription_plan_id 
     WHERE bp.id = ? LIMIT 1`,
    [billingPlanId]
  );

  if (rows.length > 0) {
    const row = rows[0];
    const bpIsActive = Boolean(row.is_active);
    const spIsActive = Boolean(row.sp_id && row.sp_is_active);

    return {
      exists: true,
      isActive: bpIsActive,
      billingPlan: row,
      subscriptionPlanId: row.sp_id || null,
      subscriptionPlanValid: spIsActive,
    };
  }

  return { exists: false, isActive: false, billingPlan: null, subscriptionPlanId: null, subscriptionPlanValid: false };
}

/**
 * Resolves a valid subscription_plan.id EXCLUSIVELY from `subscription_plans`.
 * NEVER queries billing_plans and NEVER returns a billing_plans.id.
 */
export async function resolveValidSubscriptionPlanId(
  requestedPlanId?: string | null,
  context?: PlanContextInfo,
  conn?: any
): Promise<string> {
  if (requestedPlanId) {
    const check = await validateSubscriptionPlan(requestedPlanId, conn);
    if (check.exists && check.isActive) {
      return requestedPlanId;
    }
  }

  console.warn("[Plan Validator] Direct subscription_plan lookup failed or inactive. Resolving active default trial plan.", {
    requested_plan_id: requestedPlanId,
    user_id: context?.userId || context?.tenantId || "system",
    operation: context?.operation || "plan_resolution",
  });

  // 1. Query active plan with slug 'basic' or 'basico' in subscription_plans
  const basicSubPlans = await executeQuery(
    conn,
    "SELECT id FROM subscription_plans WHERE (slug = 'basic' OR slug = 'basico') AND is_active = 1 LIMIT 1",
    []
  );
  if (basicSubPlans.length > 0) {
    return basicSubPlans[0].id;
  }

  // 2. Query any active plan in subscription_plans
  const activeSubPlans = await executeQuery(
    conn,
    "SELECT id FROM subscription_plans WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1",
    []
  );
  if (activeSubPlans.length > 0) {
    return activeSubPlans[0].id;
  }

  throw new Error("Plano padrão de assinatura não configurado corretamente.");
}

/**
 * Alias function maintaining backward compatibility while enforcing strict subscription_plan validation.
 */
export async function resolveValidPlanId(
  requestedPlanId?: string | null,
  context?: PlanContextInfo,
  conn?: any
): Promise<string> {
  return resolveValidSubscriptionPlanId(requestedPlanId, context, conn);
}

/**
 * Defensive assertion before any INSERT or UPDATE in `subscriptions`.
 * Ensures planId exists in `subscription_plans` and is_active = 1.
 */
export async function assertValidPlanForSubscription(
  planId: string | null | undefined,
  conn?: any
): Promise<string> {
  return resolveValidSubscriptionPlanId(planId, { operation: "assertValidPlanForSubscription" }, conn);
}

/**
 * Legacy support for validatePlanExistence (checks subscription_plans first, then billing_plans).
 */
export async function validatePlanExistence(planId: string | null | undefined, conn?: any) {
  const subCheck = await validateSubscriptionPlan(planId, conn);
  if (subCheck.exists) {
    return { exists: true, isActive: subCheck.isActive, plan: subCheck.plan, table: "subscription_plans" as const };
  }

  const billCheck = await validateBillingPlan(planId, conn);
  if (billCheck.exists) {
    return { exists: true, isActive: billCheck.isActive, plan: billCheck.billingPlan, table: "billing_plans" as const };
  }

  return { exists: false, isActive: false, plan: null, table: null };
}

/**
 * Validates billing plan for checkout and rejects with friendly 400 Response if invalid or inactive.
 */
export async function validateOrRejectBillingPlan(
  billingPlanId: string | null | undefined,
  context: PlanContextInfo,
  conn?: any
): Promise<{ valid: boolean; response?: Response; billingPlanResult?: BillingPlanValidationResult }> {
  const check = await validateBillingPlan(billingPlanId, conn);

  if (!check.exists) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          error: "O plano selecionado não está disponível ou está configurado incorretamente.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
      billingPlanResult: check,
    };
  }

  if (!check.isActive || !check.subscriptionPlanValid) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          error: "O plano selecionado está inativo no momento. Selecione outro plano.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
      billingPlanResult: check,
    };
  }

  return { valid: true, billingPlanResult: check };
}

/**
 * Alias for backward compatibility
 */
export async function validateOrRejectPlan(planId: string | null | undefined, context: PlanContextInfo, conn?: any) {
  return validateOrRejectBillingPlan(planId, context, conn);
}
