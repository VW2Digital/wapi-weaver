import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "./db";
import { differenceInDays, isAfter, addDays, addMonths, addYears } from "date-fns";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Verifies JWT token in API requests and returns authenticated user details.
 */
export async function verifyApiUser(request: Request): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Bearer token required");
  }
  const token = authHeader.replace("Bearer ", "");
  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    throw new Error("Unauthorized: Invalid token");
  }

  if (!decoded || !decoded.sub) {
    throw new Error("Unauthorized: Invalid token payload");
  }

  const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
  const effectiveUserId = await resolveEffectiveUserId(decoded.sub);

  return {
    userId: decoded.sub,
    tenantId: effectiveUserId,
    email: decoded.email || "",
    role: decoded.role || "user",
  };
}

/**
 * Dynamically calculates active subscription status based on expires_at and grace_period.
 */
export function calculateSubscriptionStatus(subscription: {
  status: string;
  expires_at: Date | string;
  grace_period_ends_at?: Date | string | null;
  cancelled_at?: Date | string | null;
}): string {
  if (subscription.status === "cancelled") {
    return "cancelled";
  }

  const now = new Date();
  const expiresAt = new Date(subscription.expires_at);

  if (isAfter(expiresAt, now)) {
    const daysLeft = differenceInDays(expiresAt, now);
    if (daysLeft <= 3) {
      return "expiring";
    }
    return subscription.status === "trial" ? "trial" : "active";
  }

  // Overdue
  const gracePeriodEndsAt = subscription.grace_period_ends_at
    ? new Date(subscription.grace_period_ends_at)
    : expiresAt;

  if (isAfter(gracePeriodEndsAt, now)) {
    return "past_due";
  }

  return "suspended";
}

/**
 * Gets the tenant's current subscription, or automatically provisions a default trial if none exists.
 */
export async function getOrCreateSubscription(tenantId: string, customerId: string): Promise<any> {
  const subs = (await db.query(
    "SELECT * FROM subscriptions WHERE tenant_id = ? LIMIT 1",
    [tenantId],
  )) as any[];

  if (subs.length > 0) {
    const sub = subs[0];
    const realStatus = calculateSubscriptionStatus(sub);
    if (realStatus !== sub.status) {
      await db.query("UPDATE subscriptions SET status = ? WHERE id = ?", [realStatus, sub.id]);
      sub.status = realStatus;
    }
    return sub;
  }

  // Create default trial
  const plans = (await db.query("SELECT id FROM billing_plans WHERE id = 'plan-mensal' LIMIT 1")) as any[];
  const planId = plans.length > 0 ? plans[0].id : "plan-mensal";

  const subId = crypto.randomUUID();
  const startsAt = new Date();
  const expiresAt = addDays(startsAt, 7); // 7 days trial
  const graceEndsAt = addDays(expiresAt, 3); // 3 days tolerance

  await db.query(
    `INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, starts_at, expires_at, grace_period_ends_at, auto_renew)
     VALUES (?, ?, ?, ?, 'trial', ?, ?, ?, false)`,
    [subId, tenantId, customerId, planId, startsAt, expiresAt, graceEndsAt],
  );

  const newSub = {
    id: subId,
    tenant_id: tenantId,
    customer_id: customerId,
    plan_id: planId,
    status: "trial",
    starts_at: startsAt,
    expires_at: expiresAt,
    grace_period_ends_at: graceEndsAt,
    auto_renew: false,
  };

  await logSubscriptionEvent(tenantId, subId, "subscription_created", null, "trial");

  return newSub;
}

/**
 * Logs subscription audit/history events.
 */
export async function logSubscriptionEvent(
  tenantId: string,
  subscriptionId: string,
  eventType: string,
  previousStatus: string | null,
  newStatus: string,
  invoiceId: string | null = null,
  paymentId: string | null = null,
  metadata: any = null,
  createdBy: string | null = null,
): Promise<void> {
  const eventId = crypto.randomUUID();
  await db.query(
    `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, invoice_id, payment_id, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      tenantId,
      subscriptionId,
      eventType,
      previousStatus,
      newStatus,
      invoiceId,
      paymentId,
      metadata ? JSON.stringify(metadata) : null,
      createdBy,
    ],
  );
}

/**
 * Process an approved payment: renews the subscription, marks invoice as paid, logs events.
 * Must be executed within a transaction to maintain atomicity and concurrency control.
 */
export async function processApprovedPayment(
  connection: any,
  providerPaymentId: string,
  approvedAtDate: Date,
  amountReceived: number,
  currencyReceived: string,
  rawResponse: any,
): Promise<{ success: boolean; newExpiresAt?: Date; alreadyProcessed?: boolean }> {
  // 1. Fetch the payment record and lock it
  const [payments] = await connection.execute(
    "SELECT * FROM billing_payments WHERE provider_payment_id = ? AND provider = 'mercadopago' FOR UPDATE",
    [providerPaymentId],
  );
  if (payments.length === 0) {
    throw new Error(`Payment record not found for provider ID ${providerPaymentId}`);
  }
  const payment = payments[0];

  if (payment.status === "approved" || payment.status === "paid") {
    return { success: true, alreadyProcessed: true };
  }

  // 2. Fetch and lock invoice
  const [invoices] = await connection.execute(
    "SELECT * FROM billing_invoices WHERE id = ? FOR UPDATE",
    [payment.invoice_id],
  );
  if (invoices.length === 0) {
    throw new Error(`Invoice not found: ${payment.invoice_id}`);
  }
  const invoice = invoices[0];

  if (invoice.status === "paid") {
    return { success: true, alreadyProcessed: true };
  }

  // Double check payment amount
  if (Number(amountReceived) < Number(invoice.amount)) {
    throw new Error(`Inconsistent payment amount. Received: ${amountReceived}, expected: ${invoice.amount}`);
  }

  // 3. Fetch plan
  const [plans] = await connection.execute(
    "SELECT * FROM billing_plans WHERE id = ?",
    [invoice.plan_id],
  );
  if (plans.length === 0) {
    throw new Error(`Plan not found: ${invoice.plan_id}`);
  }
  const plan = plans[0];

  // 4. Fetch subscription
  const [subs] = await connection.execute(
    "SELECT * FROM subscriptions WHERE id = ? FOR UPDATE",
    [invoice.subscription_id],
  );
  if (subs.length === 0) {
    throw new Error(`Subscription not found: ${invoice.subscription_id}`);
  }
  const sub = subs[0];

  const previousStatus = sub.status;

  // Calculate new expiration date
  const now = new Date();
  const currentExpiresAt = new Date(sub.expires_at);
  const baseDate = isAfter(currentExpiresAt, now) ? currentExpiresAt : now;

  let newExpiresAt = new Date(baseDate);
  if (plan.billing_interval === "day") {
    newExpiresAt = addDays(baseDate, plan.billing_interval_count);
  } else if (plan.billing_interval === "week") {
    newExpiresAt = addDays(baseDate, plan.billing_interval_count * 7);
  } else if (plan.billing_interval === "month") {
    newExpiresAt = addMonths(baseDate, plan.billing_interval_count);
  } else if (plan.billing_interval === "year") {
    newExpiresAt = addYears(baseDate, plan.billing_interval_count);
  } else {
    newExpiresAt = addDays(baseDate, plan.duration_days);
  }

  const newGracePeriodEndsAt = addDays(newExpiresAt, 3); // 3 days tolerance

  // 5. Update billing_payments
  await connection.execute(
    `UPDATE billing_payments 
     SET status = 'approved', approved_at = ?, raw_response = ?
     WHERE id = ?`,
    [approvedAtDate, JSON.stringify(rawResponse), payment.id],
  );

  // 6. Update billing_invoices
  await connection.execute(
    `UPDATE billing_invoices
     SET status = 'paid', paid_at = ?
     WHERE id = ?`,
    [approvedAtDate, invoice.id],
  );

  // 7. Update subscription details and remove any tenant block state
  await connection.execute(
    `UPDATE subscriptions
     SET status = 'active', expires_at = ?, grace_period_ends_at = ?, last_payment_at = ?, next_billing_at = ?
     WHERE id = ?`,
    [newExpiresAt, newGracePeriodEndsAt, approvedAtDate, newExpiresAt, sub.id],
  );

  // 8. Log history event
  const eventId = crypto.randomUUID();
  await connection.execute(
    `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, invoice_id, payment_id, metadata)
     VALUES (?, ?, ?, 'subscription_renewed', ?, 'active', ?, ?, ?)`,
    [
      eventId,
      sub.tenant_id,
      sub.id,
      previousStatus,
      invoice.id,
      payment.id,
      JSON.stringify({ expires_at: newExpiresAt }),
    ],
  );

  // 9. Generate tenant-scoped notifications
  const notifId = crypto.randomUUID();
  const dateStr = newExpiresAt.toLocaleDateString("pt-BR");
  await connection.execute(
    `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, unique_key)
     VALUES (?, ?, ?, 'payment_approved', 'Pagamento Confirmado!', ?, ?)`,
    [
      notifId,
      sub.tenant_id,
      sub.customer_id,
      `Pagamento confirmado! Seu plano foi renovado até ${dateStr}.`,
      `payment_approved:${payment.id}:${newExpiresAt.getTime()}`,
    ],
  );

  return { success: true, newExpiresAt };
}

