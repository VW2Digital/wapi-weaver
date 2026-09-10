import { createFileRoute } from "@tanstack/react-router";
import { processDsAgentFollowupsOnce } from "@/lib/ds-agent-followup.server";

export const Route = createFileRoute("/api/public/cron/process-ds-agent-followups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader =
          request.headers.get("x-cron-secret") || request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "bliv-cron-secret";

        if (authHeader !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
          return new Response(JSON.stringify({ error: "Unauthorized: Invalid CRON secret" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = await processDsAgentFollowupsOnce();
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
