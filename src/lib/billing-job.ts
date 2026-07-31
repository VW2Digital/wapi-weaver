import db from "./db";
import { getOrCreateSubscription, calculateSubscriptionStatus, logSubscriptionEvent } from "./subscription-helpers";
import { differenceInDays, isBefore, addDays } from "date-fns";

export async function runBillingJob() {
  if (process.env.BILLING_JOB_ENABLED !== "true") {
    console.info("[Billing Job] Desativado por variável de ambiente (BILLING_JOB_ENABLED).");
    return;
  }

  if (process.env.NODE_ENV === "test" || process.env.IS_BUILD === "true") {
    return;
  }

  const connection = await db.pool.getConnection();
  const startTime = Date.now();

  try {
    const [rows] = await connection.query("SELECT GET_LOCK('wapi_billing_checker', 0) AS locked");
    const locked = Number((rows as any[])[0]?.locked ?? 0);

    if (locked !== 1) {
      console.info("[Billing Job] Outro processo/VPS já está executando o job diário.");
      return;
    }

    console.info("[Billing Job] Lock obtido. Iniciando processamento diário...");
    await executarBillingJobInterno(connection);

  } catch (err) {
    console.error("[Billing Job Error]", err);
  } finally {
    try {
      await connection.query("SELECT RELEASE_LOCK('wapi_billing_checker')");
    } catch (e) {
      console.error("[Billing Job] Falha ao liberar lock:", e);
    } finally {
      connection.release();
      console.info(`[Billing Job] Conexão devolvida ao pool. Duração: ${Date.now() - startTime}ms.`);
    }
  }
}

async function executarBillingJobInterno(connection: any) {
  const [subs] = await connection.query(
    "SELECT * FROM subscriptions WHERE status NOT IN ('cancelled', 'suspended')",
  ) as any[];

  console.log(`[Billing Job] Encontradas ${subs.length} assinaturas ativas para verificar.`);

  const now = new Date();

  for (const sub of subs) {
    const expiresAt = new Date(sub.expires_at);
    const daysRemaining = differenceInDays(expiresAt, now);
    const realStatus = calculateSubscriptionStatus(sub);

    // Update status if it changed
    if (realStatus !== sub.status) {
      await connection.query("UPDATE subscriptions SET status = ? WHERE id = ?", [realStatus, sub.id]);
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
    const [plans] = await connection.query("SELECT name, price FROM billing_plans WHERE id = ? LIMIT 1", [
      sub.plan_id,
    ]) as any[];
    const plan = plans.length > 0 ? plans[0] : { name: "Plano", price: 0.0 };

    const dateStr = expiresAt.toLocaleDateString("pt-BR");

    // Generate notifications for 3, 2, 1, 0, or negative days remaining
    if (daysRemaining <= 3) {
      const uniqueKey = `subscription_expiring:${sub.id}:${expiresAt.toISOString().slice(0, 10)}:${daysRemaining}`;

      // Check if notification already exists
      const [existing] = await connection.query("SELECT id FROM notifications WHERE unique_key = ? LIMIT 1", [
        uniqueKey,
      ]) as any[];

      if (existing.length === 0) {
        const title = daysRemaining > 0 
          ? `Sua assinatura vence em ${daysRemaining} dia${daysRemaining > 1 ? "s" : ""}`
          : daysRemaining === 0 
            ? "Sua assinatura vence hoje!"
            : "Sua assinatura está vencida!";

        const message = daysRemaining >= 0
          ? `Seu plano ${plan.name} (R$ ${plan.price}) vence em ${dateStr}. Renove agora para continuar utilizando todos os recursos da plataforma.`
          : `Sua assinatura do plano ${plan.name} venceu em ${dateStr}. Regularize o pagamento para desbloquear seu acesso.`;

        try {
          await connection.query(
            `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, action_url, is_read, unique_key)
             VALUES (UUID(), ?, ?, 'subscription_expiration_warning', ?, ?, '/billing', false, ?)`,
            [sub.tenant_id, sub.customer_id, title, message, uniqueKey],
          );
          console.log(`[Billing Job] Criada notificação de vencimento para o tenant ${sub.tenant_id} (${daysRemaining} dias restantes)`);
        } catch (err: any) {
          if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
            console.log(`[Billing Job] Notificação com unique_key ${uniqueKey} já processada concorrentemente.`);
          } else {
            throw err;
          }
        }
      }
    }
  }
}
