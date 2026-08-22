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
          const subPlans = (await db.query("SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [
            sub.plan_id,
          ])) as any[];
          const subscriptionPlan = subPlans.length > 0 ? subPlans[0] : null;

          // Get commercial plan details from billing_plans
          const billingPlans = (await db.query("SELECT * FROM billing_plans WHERE subscription_plan_id = ? OR id = ? LIMIT 1", [
            sub.plan_id,
            sub.plan_id,
          ])) as any[];
          const billingPlan = billingPlans.length > 0 ? billingPlans[0] : null;

          return new Response(
            JSON.stringify({
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
          return new Response(JSON.stringify({ error: isAuthErr ? "Sessão expirada. Faça login novamente." : err.message }), {
            status: isAuthErr ? 401 : 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
