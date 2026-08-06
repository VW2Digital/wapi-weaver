import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/check-plans")({
  server: {
    handlers: {
      GET: async () => {
        const { default: db } = await import("@/lib/db");
        const subPlans = await db.query("SELECT * FROM subscription_plans");
        const billingPlans = await db.query("SELECT * FROM billing_plans");
        return new Response(JSON.stringify({ subPlans, billingPlans }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
