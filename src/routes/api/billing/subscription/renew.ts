// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import {
  verifyApiUser,
  logSubscriptionEvent,
  calculateSubscriptionStatus,
} from "@/lib/subscription-helpers";
import { addDays, isAfter } from "date-fns";
import { isMaster } from "@/lib/roles";

export const Route = createFileRoute("/api/billing/subscription/renew")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { tenantId, planId, durationDays, justification } = body;

          // Renewing another tenant is restricted to the platform Admin Master.
          if (tenantId && tenantId !== user.tenantId) {
            if (!isMaster(user.role)) {
              return new Response(
                JSON.stringify({
                  error: "Acesso negado: privilégios de administrador necessários.",
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            if (!justification || justification.trim().length < 5) {
              return new Response(
                JSON.stringify({ error: "Justificativa obrigatória (mínimo 5 caracteres)." }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            // Fetch tenant subscription
            const subs = (await db.query(
              "SELECT * FROM subscriptions WHERE tenant_id = ? LIMIT 1",
              [tenantId],
            )) as any[];

            if (subs.length === 0) {
              return new Response(
                JSON.stringify({ error: "Assinatura do inquilino não encontrada." }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            const sub = subs[0];
            const previousStatus = sub.status;

            // Fetch plan
            const targetPlanId = planId || sub.plan_id;
            const plans = (await db.query("SELECT * FROM billing_plans WHERE id = ? LIMIT 1", [
              targetPlanId,
            ])) as any[];
            const plan = plans.length > 0 ? plans[0] : null;

            const days = durationDays ? Number(durationDays) : plan ? plan.duration_days : 30;

            const now = new Date();
            const currentExpiresAt = new Date(sub.expires_at);
            const baseDate = isAfter(currentExpiresAt, now) ? currentExpiresAt : now;
            const newExpiresAt = addDays(baseDate, days);
            const newGraceEnds = addDays(newExpiresAt, 3);

            // Audit transaction
            await db.transaction(async (conn) => {
              // Create manual invoice
              const invoiceId = crypto.randomUUID();
              const invoiceNumber = `MAN-${Date.now()}`;
              await conn.execute(
                `INSERT INTO billing_invoices (
                  id, tenant_id, customer_id, subscription_id, plan_id,
                  invoice_number, description, amount, currency, status,
                  due_at, paid_at, external_reference, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, 'Renovação Manual Administrador', ?, 'BRL', 'paid', ?, ?, ?, ?)`,
                [
                  invoiceId,
                  tenantId,
                  sub.customer_id,
                  sub.id,
                  targetPlanId,
                  invoiceNumber,
                  plan ? plan.price : 0.0,
                  now,
                  now,
                  `manual:${crypto.randomUUID()}`,
                  JSON.stringify({ justification, renewed_by: user.userId }),
                ],
              );

              // Update subscription
              await conn.execute(
                `UPDATE subscriptions
                 SET status = 'active', expires_at = ?, grace_period_ends_at = ?, last_payment_at = ?
                 WHERE id = ?`,
                [newExpiresAt, newGraceEnds, now, sub.id],
              );

              // Log subscription event
              const eventId = crypto.randomUUID();
              await conn.execute(
                `INSERT INTO subscription_events (id, tenant_id, subscription_id, event_type, previous_status, new_status, invoice_id, metadata, created_by)
                 VALUES (?, ?, ?, 'subscription_reactivated', ?, 'active', ?, ?, ?)`,
                [
                  eventId,
                  tenantId,
                  sub.id,
                  previousStatus,
                  invoiceId,
                  JSON.stringify({ justification, days, newExpiresAt }),
                  user.userId,
                ],
              );

              // Create notification
              const notifId = crypto.randomUUID();
              const dateStr = newExpiresAt.toLocaleDateString("pt-BR");
              await conn.execute(
                `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, unique_key)
                 VALUES (?, ?, ?, 'manual_renewal', 'Assinatura Atualizada', ?, ?)`,
                [
                  notifId,
                  tenantId,
                  sub.customer_id,
                  `Sua assinatura foi atualizada manualmente pelo administrador até ${dateStr}.`,
                  `manual_renewal:${sub.id}:${Date.now()}`,
                ],
              );
            });

            return new Response(
              JSON.stringify({
                success: true,
                message: "Assinatura renovada manualmente com sucesso.",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Otherwise, normal tenant checkout initiation (fallback/shortcut to checkout)
          return new Response(
            JSON.stringify({
              error: "Operação inválida. Use as rotas de checkout para pagamentos automáticos.",
            }),
            {
              status: 400,
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
