// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/plans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await verifyApiUser(request); // Protect, only authenticated users can view plans
          const plans = (await db.query("SELECT * FROM billing_plans WHERE is_active = true ORDER BY price ASC")) as any[];

          return new Response(
            JSON.stringify({
              plans,
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
