// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/subscription")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const { getTenantSubscriptionAccess } = await import("@/lib/services/subscription-access.service");
          // Esta rota é consultada periodicamente pela interface e precisa ser somente leitura.
          // Criação e reconciliação de assinaturas pertencem aos fluxos de cadastro/pagamento.
          const access = await getTenantSubscriptionAccess(user.userId, { reconcile: false });
          const subscriptions = (await db.query(
            "SELECT * FROM subscriptions WHERE tenant_id = ? LIMIT 1",
            [user.tenantId],
          )) as any[];
          const sub = subscriptions[0] ?? null;

          // Get operational plan details from subscription_plans
          let subscriptionPlan = null;
          try {
            if (sub && sub.plan_id) {
              const subPlans = (await db.query("SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [
                sub.plan_id,
              ])) as any[];
              subscriptionPlan = subPlans.length > 0 ? subPlans[0] : null;
            }
          } catch (err: any) {
            console.error("[BILLING ERROR] Erro ao buscar subscription_plans:", err.message);
          }

          // Get commercial plan details from billing_plans
          let billingPlan = null;
          try {
            if (sub && sub.plan_id) {
              const billingPlans = (await db.query("SELECT * FROM billing_plans WHERE subscription_plan_id = ? OR id = ? LIMIT 1", [
                sub.plan_id,
                sub.plan_id,
              ])) as any[];
              billingPlan = billingPlans.length > 0 ? billingPlans[0] : null;
            }
          } catch (err: any) {
            console.error("[BILLING ERROR] Erro ao buscar billing_plans:", err.message);
          }

          // Safe BigInt replacer para prevenir: TypeError: Do not know how to serialize a BigInt
          const safeStringify = (obj: any) =>
            JSON.stringify(obj, (_key, value) => (typeof value === "bigint" ? value.toString() : value));

          return new Response(
            safeStringify({
              subscription: sub,
              plan: billingPlan,
              subscriptionPlan,
              access,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : undefined;
          console.error("[BILLING ERROR] etapa: GET /api/billing/subscription", "message:", message, "stack:", stack);
          const isAuthErr = message.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({
            error: isAuthErr
              ? "Sessão expirada. Faça login novamente."
              : "Não foi possível consultar a assinatura.",
          }), {
            status: isAuthErr ? 401 : 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
