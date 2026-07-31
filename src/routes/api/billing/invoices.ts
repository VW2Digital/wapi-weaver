// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/invoices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);

          // Get all invoices with plan names
          const invoices = (await db.query(
            `SELECT i.*, p.name as plan_name 
             FROM billing_invoices i 
             LEFT JOIN billing_plans p ON i.plan_id = p.id
             WHERE i.tenant_id = ? 
             ORDER BY i.created_at DESC`,
            [user.tenantId],
          )) as any[];

          // Get payment status mapping
          const payments = (await db.query(
            `SELECT id, invoice_id, provider, payment_method, status, amount, created_at, provider_preference_id, provider_payment_id
             FROM billing_payments 
             WHERE tenant_id = ?`,
            [user.tenantId],
          )) as any[];

          return new Response(
            JSON.stringify({
              invoices,
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
