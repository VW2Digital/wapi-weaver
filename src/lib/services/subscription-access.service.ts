import db from "@/lib/db";
import { verifyApiUser, AuthenticatedUser } from "@/lib/subscription-helpers";
import { resolveEffectiveUserId } from "@/lib/chat-helpers";
import crypto from "crypto";

/**
 * Normaliza o resultado de qualquer executor (db wrapper ou raw mysql2 connection).
 * O db wrapper retorna rows diretamente; uma mysql2 raw connection retorna [rows, fields].
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  // mysql2 raw connection retorna [rows, fields] — extrair apenas rows
  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[1])) {
    const potentialFields = result[1];
    if (potentialFields.length === 0 || (potentialFields[0] && "name" in potentialFields[0])) {
      return Array.isArray(result[0]) ? result[0] : [];
    }
  }
  return Array.isArray(result) ? result : [];
}

/**
 * Cria um executor normalizado que sempre retorna rows (não [rows, fields]).
 * Compatível com db wrapper e mysql2 raw connections.
 */
function makeExecutor(connection?: any) {
  const raw = connection || db;
  return {
    async query(sql: string, params?: any[]): Promise<any[]> {
      const result = await raw.query(sql, params);
      return normalizeRows(result);
    },
    async execute(sql: string, params?: any[]): Promise<any[]> {
      const fn = raw.execute || raw.query;
      const result = await fn.call(raw, sql, params);
      return normalizeRows(result);
    },
  };
}


export interface SubscriptionAccessState {
  allowed: boolean;
  status: "trialing" | "active" | "past_due" | "expired" | "cancelled" | "suspended" | "admin_bypass" | "legacy_unrestricted";
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  trialConsumedAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  remainingSeconds: number;
  reason: string | null;
  plan?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * Retorna o plano padrão de trial a ser atribuído para novos clientes.
 * Busca o plano com slug = 'basic' e is_active = 1 em subscription_plans (NUNCA hardcoded).
 * Se não for encontrado por 'basic', busca o primeiro plano ativo em subscription_plans.
 * Caso não encontre nenhum plano ativo, lança erro defensivo claro.
 */
export async function getDefaultTrialPlanId(connection?: any): Promise<string> {
  const executor = makeExecutor(connection);

  // 1. Buscar pelo plano com slug = 'basic' ou 'basico' ativo em subscription_plans
  const basicPlans = await executor.query(
    "SELECT id FROM subscription_plans WHERE (slug = 'basic' OR slug = 'basico') AND is_active = 1 LIMIT 1"
  );
  if (basicPlans && basicPlans.length > 0) {
    return basicPlans[0].id;
  }

  // 2. Fallback: Primeiro plano ativo em subscription_plans (NUNCA billing_plans)
  const activePlans = await executor.query(
    "SELECT id FROM subscription_plans WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1"
  );
  if (activePlans && activePlans.length > 0) {
    return activePlans[0].id;
  }

  throw new Error("Plano padrão de assinatura não configurado corretamente.");
}

/**
 * Cria a assinatura de teste gratuito de EXATAMENTE 3 DIAS (72h) para um novo tenant/cliente.
 * Chamada durante o fluxo de cadastro público do tenant.
 */
export async function createTrialSubscriptionForTenant(
  tenantId: string,
  customerId: string,
  connection?: any
): Promise<any> {
  const executor = makeExecutor(connection);

  // 1. Verificar se o tenant já possui registro de subscription
  const existing = await executor.query(
    "SELECT id, trial_consumed_at FROM subscriptions WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );

  if (existing && existing.length > 0) {
    // Trial não pode ser reiniciado se já foi consumido
    return existing[0];
  }

  const rawPlanId = await getDefaultTrialPlanId(connection);

  // Validação defensiva pré-inserção: garante que o plan_id existe e está ativo
  const { assertValidPlanForSubscription } = await import("@/lib/plan-validator");
  const planId = await assertValidPlanForSubscription(rawPlanId, connection);

  const subId = crypto.randomUUID();

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 72 horas exatas

  await executor.query(
    `INSERT INTO subscriptions (
      id, tenant_id, customer_id, plan_id, status,
      trial_started_at, trial_ends_at, trial_consumed_at,
      current_period_start, current_period_end, created_at
    ) VALUES (?, ?, ?, ?, 'trialing', ?, ?, ?, ?, ?, NOW())`,
    [
      subId,
      tenantId,
      customerId,
      planId,
      now,
      trialEndsAt,
      now,
      now,
      trialEndsAt,
    ]
  );

  // Registrar evento no histórico de auditoria
  const eventId = crypto.randomUUID();
  await executor.query(
    `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload)
     VALUES (?, ?, ?, 'trial_started', NULL, 'trialing', 'system', ?)`,
    [
      eventId,
      tenantId,
      subId,
      JSON.stringify({ trial_started_at: now, trial_ends_at: trialEndsAt }),
    ]
  );

  return {
    id: subId,
    tenant_id: tenantId,
    customer_id: customerId,
    plan_id: planId,
    status: "trialing",
    trial_started_at: now,
    trial_ends_at: trialEndsAt,
    trial_consumed_at: now,
  };
}

/**
 * Consulta e avalia o status oficial de acesso por assinatura do tenant.
 */
export async function getTenantSubscriptionAccess(userId: string): Promise<SubscriptionAccessState> {
  const tenantId = await resolveEffectiveUserId(userId);

  // 1. Verificar se é Admin Master Global da Plataforma (Bypass de cobrança)
  const roleRows = (await db.query(
    "SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin_master' LIMIT 1",
    [userId]
  )) as any[];

  if (roleRows && roleRows.length > 0) {
    return {
      allowed: true,
      status: "admin_bypass",
      remainingSeconds: 315360000, // 10 anos
      reason: null,
      plan: { id: "admin", name: "Admin Master", code: "admin_master" },
    };
  }

  // 2. Buscar assinatura do tenant
  const subs = (await db.query(
    `SELECT s.*, p.name as plan_name, p.slug as plan_code
     FROM subscriptions s
     LEFT JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.tenant_id = ? LIMIT 1`,
    [tenantId]
  )) as any[];

  // 3. Se não houver assinatura registrada (Tenants legados anteriores à regra de trial):
  if (!subs || subs.length === 0) {
    // Preservar clientes existentes garantindo acesso irrestrito
    return {
      allowed: true,
      status: "legacy_unrestricted",
      remainingSeconds: 315360000,
      reason: null,
      plan: { id: "legacy", name: "Plano Legado", code: "legacy" },
    };
  }

  const sub = subs[0];
  const now = new Date();
  const planInfo = sub.plan_id
    ? { id: sub.plan_id, name: sub.plan_name || "Plano Padrão", code: sub.plan_code || "standard" }
    : null;

  const currentStatus = String(sub.status || "").toLowerCase();

  // A) STATUS = TRIALING / TRIAL
  if (currentStatus === "trialing" || currentStatus === "trial") {
    const trialEndsAt = sub.trial_ends_at
      ? new Date(sub.trial_ends_at)
      : sub.current_period_end
      ? new Date(sub.current_period_end)
      : new Date(sub.expires_at || sub.created_at);

    const remainingSeconds = Math.max(0, Math.floor((trialEndsAt.getTime() - now.getTime()) / 1000));

    if (now.getTime() >= trialEndsAt.getTime()) {
      // Trial Expirou! Persistir alteração de status se ainda estiver como trialing
      await db.query("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [sub.id]);
      const eventId = crypto.randomUUID();
      await db.query(
        `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload)
         VALUES (?, ?, ?, 'trial_expired', ?, 'expired', 'system', '{}')`,
        [eventId, tenantId, sub.id, currentStatus]
      );

      return {
        allowed: false,
        status: "expired",
        trialStartedAt: sub.trial_started_at ? new Date(sub.trial_started_at).toISOString() : null,
        trialEndsAt: trialEndsAt.toISOString(),
        trialConsumedAt: sub.trial_consumed_at ? new Date(sub.trial_consumed_at).toISOString() : null,
        remainingSeconds: 0,
        reason: "trial_expired",
        plan: planInfo,
      };
    }

    return {
      allowed: true,
      status: "trialing",
      trialStartedAt: sub.trial_started_at ? new Date(sub.trial_started_at).toISOString() : null,
      trialEndsAt: trialEndsAt.toISOString(),
      trialConsumedAt: sub.trial_consumed_at ? new Date(sub.trial_consumed_at).toISOString() : null,
      remainingSeconds,
      reason: null,
      plan: planInfo,
    };
  }

  // B) STATUS = ACTIVE
  if (currentStatus === "active") {
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end)
      : sub.expires_at
      ? new Date(sub.expires_at)
      : null;

    if (periodEnd && now.getTime() >= periodEnd.getTime()) {
      // Período pago expirou!
      await db.query("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [sub.id]);
      const eventId = crypto.randomUUID();
      await db.query(
        `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload)
         VALUES (?, ?, ?, 'subscription_expired', ?, 'expired', 'system', '{}')`,
        [eventId, tenantId, sub.id, currentStatus]
      );

      return {
        allowed: false,
        status: "expired",
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start).toISOString() : null,
        currentPeriodEnd: periodEnd.toISOString(),
        remainingSeconds: 0,
        reason: "subscription_expired",
        plan: planInfo,
      };
    }

    const remainingSeconds = periodEnd
      ? Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / 1000))
      : 2592000;

    return {
      allowed: true,
      status: "active",
      currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start).toISOString() : null,
      currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
      remainingSeconds,
      reason: null,
      plan: planInfo,
    };
  }

  // C) OUTROS STATUS (expired, past_due, cancelled, suspended)
  return {
    allowed: false,
    status: (["expired", "past_due", "cancelled", "suspended"].includes(currentStatus)
      ? currentStatus
      : "expired") as any,
    trialStartedAt: sub.trial_started_at ? new Date(sub.trial_started_at).toISOString() : null,
    trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at).toISOString() : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end).toISOString() : null,
    remainingSeconds: 0,
    reason: "subscription_required",
    plan: planInfo,
  };
}

/**
 * Middleware central de validação de assinatura para Server Functions / API Routes.
 * Interrompe a requisição com HTTP 402 se o acesso do tenant estiver bloqueado.
 */
export async function requireSubscriptionAccess(request: Request): Promise<{
  user: AuthenticatedUser;
  access: SubscriptionAccessState;
}> {
  const user = await verifyApiUser(request);
  const access = await getTenantSubscriptionAccess(user.userId);

  if (!access.allowed) {
    throw new Response(
      JSON.stringify({
        error: "SUBSCRIPTION_REQUIRED",
        code: "SUBSCRIPTION_REQUIRED",
        message: "Seu período de teste terminou. Ative sua assinatura para continuar utilizando o BLIV CRM.",
        status: access.status,
        access,
      }),
      {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return { user, access };
}

/**
 * Ativa formalmente a assinatura após confirmação do pagamento pelo Gateway (Webhook Server-Side).
 */
export async function activateSubscriptionFromPayment(
  connection: any,
  tenantId: string,
  planId: string,
  durationDays: number = 30
): Promise<any> {
  const executor = makeExecutor(connection);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const existing = await executor.query(
    "SELECT id, status FROM subscriptions WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );

  if (existing && existing.length > 0) {
    const sub = existing[0];
    const prevStatus = sub.status;

    await executor.query(
      `UPDATE subscriptions
       SET plan_id = ?, status = 'active', current_period_start = ?, current_period_end = ?, activated_at = ?
       WHERE id = ?`,
      [planId, now, periodEnd, now, sub.id]
    );

    const eventId = crypto.randomUUID();
    await executor.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload)
       VALUES (?, ?, ?, 'subscription_activated', ?, 'active', 'webhook', ?)`,
      [eventId, tenantId, sub.id, prevStatus, JSON.stringify({ planId, periodEnd })]
    );
  } else {
    const subId = crypto.randomUUID();
    await executor.query(
      `INSERT INTO subscriptions (
        id, tenant_id, customer_id, plan_id, status,
        current_period_start, current_period_end, activated_at, created_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NOW())`,
      [subId, tenantId, tenantId, planId, now, periodEnd, now]
    );

    const eventId = crypto.randomUUID();
    await executor.query(
      `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, source, raw_payload)
       VALUES (?, ?, ?, 'subscription_activated', NULL, 'active', 'webhook', ?)`,
      [eventId, tenantId, subId, JSON.stringify({ planId, periodEnd })]
    );
  }
}
