// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/plans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await verifyApiUser(request);
          const plans = (await db.query(
            `SELECT bp.*, sp.name as subscription_plan_name, sp.description as subscription_plan_desc,
                    sp.max_agents, sp.max_funnels, sp.max_users
             FROM billing_plans bp
             LEFT JOIN subscription_plans sp ON bp.subscription_plan_id = sp.id
             WHERE bp.is_active = 1 OR bp.is_active = true
             ORDER BY bp.price ASC`
          )) as any[];

          const operationalPlans = (await db.query(
            `SELECT * FROM subscription_plans WHERE is_active = 1 OR is_active = true ORDER BY name ASC`
          )) as any[];

          return new Response(
            JSON.stringify({
              plans,
              operationalPlans,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({ error: err.message }), {
            status: isAuthErr ? 401 : 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
