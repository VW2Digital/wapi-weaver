// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/payments/$id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const user = await verifyApiUser(request);
          const { id } = params;

          const rows = (await db.query(
            "SELECT status, status_detail, approved_at, invoice_id FROM billing_payments WHERE id = ? AND tenant_id = ? LIMIT 1",
            [id, user.tenantId],
          )) as any[];

          if (rows.length === 0) {
            return new Response(JSON.stringify({ error: "Pagamento não encontrado ou acesso negado." }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          // If the payment is not yet approved, we could poll MP API if desired, but we rely on webhook or returning current database state.
          // Polling will return the current database state, which is updated either by immediate card approval or webhook event.
          const payment = rows[0];

          return new Response(
            JSON.stringify({
              status: payment.status,
              statusDetail: payment.status_detail,
              approvedAt: payment.approved_at,
              invoiceId: payment.invoice_id,
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
