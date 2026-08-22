// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/subscription")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const { getTenantSubscriptionAccess } = await import("@/lib/services/subscription-access.service");
          const access = await getTenantSubscriptionAccess(user.userId);
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

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
            JSON.stringify(obj, (key, value) => (typeof value === "bigint" ? value.toString() : value));

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
        } catch (err: any) {
          console.error("[BILLING ERROR] etapa: GET /api/billing/subscription", "message:", err.message, "stack:", err.stack);
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          
          // Se for erro interno, retorne a mensagem de erro para visualização, caso contrário, oculte detalhes
          const errorMsg = isAuthErr ? "Sessão expirada. Faça login novamente." : `Erro interno: ${err.message}`;
          return new Response(JSON.stringify({ error: errorMsg }), {
            status: isAuthErr ? 401 : 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
