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
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

          // Get active plan details
          const plans = (await db.query("SELECT * FROM billing_plans WHERE id = ? LIMIT 1", [
            sub.plan_id,
          ])) as any[];

          const plan = plans.length > 0 ? plans[0] : null;

          return new Response(
            JSON.stringify({
              subscription: sub,
              plan,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
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
