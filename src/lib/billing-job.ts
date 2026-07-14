import db from "./db";
import { getOrCreateSubscription, calculateSubscriptionStatus, logSubscriptionEvent } from "./subscription-helpers";
import { differenceInDays, isBefore, addDays } from "date-fns";

export async function runBillingJob() {
  console.log("[Billing Job] Starting daily subscription and expiration check...");
  try {
    // 1. Fetch all active or trial or expiring or past_due subscriptions
    const subs = (await db.query(
      "SELECT * FROM subscriptions WHERE status NOT IN ('cancelled', 'suspended')",
    )) as any[];

    console.log(`[Billing Job] Found ${subs.length} active subscriptions to check.`);

    const now = new Date();

    for (const sub of subs) {
      const expiresAt = new Date(sub.expires_at);
      const daysRemaining = differenceInDays(expiresAt, now);
      const realStatus = calculateSubscriptionStatus(sub);

      // Update status if it changed
      if (realStatus !== sub.status) {
        await db.query("UPDATE subscriptions SET status = ? WHERE id = ?", [realStatus, sub.id]);
        await logSubscriptionEvent(
          sub.tenant_id,
          sub.id,
          realStatus === "suspended" ? "subscription_suspended" : "subscription_expiring",
          sub.status,
          realStatus,
        );
        sub.status = realStatus;
      }

      // Fetch plan details
      const plans = (await db.query("SELECT name, price FROM billing_plans WHERE id = ? LIMIT 1", [
        sub.plan_id,
      ])) as any[];
      const plan = plans.length > 0 ? plans[0] : { name: "Plano", price: 0.0 };

      const dateStr = expiresAt.toLocaleDateString("pt-BR");

      // Generate notifications for 3, 2, 1, 0, or negative days remaining
      if (daysRemaining <= 3) {
        // Unique key per sub, expiration date, and days remaining to prevent duplicates
        const uniqueKey = `subscription_expiring:${sub.id}:${expiresAt.toISOString().slice(0, 10)}:${daysRemaining}`;

        // Check if notification already exists
        const existing = (await db.query("SELECT id FROM notifications WHERE unique_key = ? LIMIT 1", [
          uniqueKey,
        ])) as any[];

        if (existing.length === 0) {
          const title = daysRemaining > 0 
            ? `Sua assinatura vence em ${daysRemaining} dia${daysRemaining > 1 ? "s" : ""}`
            : daysRemaining === 0 
              ? "Sua assinatura vence hoje!"
              : "Sua assinatura está vencida!";

          const message = daysRemaining >= 0
            ? `Seu plano ${plan.name} (R$ ${plan.price}) vence em ${dateStr}. Renove agora para continuar utilizando todos os recursos da plataforma.`
            : `Sua assinatura do plano ${plan.name} venceu em ${dateStr}. Regularize o pagamento para desbloquear seu acesso.`;

          await db.query(
            `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, action_url, is_read, unique_key)
             VALUES (UUID(), ?, ?, 'subscription_expiration_warning', ?, ?, '/billing', false, ?)`,
            [sub.tenant_id, sub.customer_id, title, message, uniqueKey],
          );

          console.log(`[Billing Job] Created notification for tenant ${sub.tenant_id} (${daysRemaining} days left)`);
        }
      }
    }

    console.log("[Billing Job] Expiration check completed successfully.");
  } catch (err) {
    console.error("[Billing Job] Error running billing job:", err);
  }
}
