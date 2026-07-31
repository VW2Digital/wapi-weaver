import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/invoices/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await verifyApiUser(request);
          const { id } = params;

          const rows = (await db.query(
            "SELECT * FROM billing_invoices WHERE id = ? AND tenant_id = ? LIMIT 1",
            [id, user.tenantId],
          )) as any[];

          if (rows.length === 0) {
            return new Response(JSON.stringify({ error: "Fatura não encontrada ou acesso negado." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch associated payment details if they exist
          const payments = await db.query(
            "SELECT * FROM billing_payments WHERE invoice_id = ? AND tenant_id = ? ORDER BY created_at DESC",
            [id, user.tenantId],
          );

          return new Response(
            JSON.stringify({
              invoice: rows[0],
              payments,
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
