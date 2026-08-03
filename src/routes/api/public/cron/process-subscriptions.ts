import { createFileRoute } from "@tanstack/react-router";
import { processOverdueGracePeriods, applyPendingPlanChanges } from "@/lib/cron-subscription";

export const Route = createFileRoute("/api/public/cron/process-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("x-cron-secret") || request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "bliv-cron-secret";

        if (authHeader !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid CRON secret" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const graceResult = await processOverdueGracePeriods();
        const planResult = await applyPendingPlanChanges();

        return new Response(
          JSON.stringify({
            success: true,
            gracePeriods: graceResult,
            planChanges: planResult,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
