// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription, logSubscriptionEvent } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, createPreference } from "@/lib/mercadopago";
import { addDays } from "date-fns";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { planId } = body;

          if (!planId) {
            return new Response(JSON.stringify({ error: "O identificador do plano é obrigatório." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch & validate plan safely
          const { validateOrRejectPlan } = await import("@/lib/plan-validator");
          const planValidation = await validateOrRejectPlan(planId, {
            userId: user.userId,
            tenantId: user.tenantId,
            operation: "checkout_initiation",
            source: "checkout_route",
          });

          if (!planValidation.valid && planValidation.response) {
            return planValidation.response;
          }

          const plan = planValidation.planResult?.plan;

          // Fetch or create subscription for tenant
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

          // Get Mercado Pago Config (tenant-specific or global platform credentials)
          let platformGatewayConfig = await getMercadoPagoConfig(user.tenantId).catch(() => null);
          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            platformGatewayConfig = await getMercadoPagoConfig("__any__").catch(() => null);
          }

          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            return new Response(
              JSON.stringify({ error: "O portal de pagamento do Mercado Pago não está configurado na plataforma." }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Check if checkout mode is redirect
          // Note: even if configured transparently, we can fall back to Checkout Pro if needed, but we check preference here.
          
          // Re-use existing pending invoice for this plan if valid
          const existingInvoices = (await db.query(
            "SELECT * FROM billing_invoices WHERE tenant_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1",
            [user.tenantId, planId],
          )) as any[];

          let invoice: any;
          if (existingInvoices.length > 0) {
            invoice = existingInvoices[0];
          } else {
            // Create a new invoice
            const invoiceId = crypto.randomUUID();
            const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const externalRef = `invoice:${crypto.randomUUID()}`;
            const dueAt = addDays(new Date(), 3); // 3 days to pay

            await db.query(
              `INSERT INTO billing_invoices (
                id, tenant_id, customer_id, subscription_id, plan_id,
                invoice_number, description, amount, currency, status,
                due_at, external_reference
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', 'pending', ?, ?)`,
              [
                invoiceId,
                user.tenantId,
                user.userId,
                sub.id,
                plan.id,
                invoiceNumber,
                `Renovação de Assinatura - ${plan.name}`,
                plan.price,
                dueAt,
                externalRef,
              ],
            );

            await logSubscriptionEvent(user.tenantId, sub.id, "invoice_created", sub.status, sub.status, invoiceId);

            invoice = {
              id: invoiceId,
              amount: plan.price,
              external_reference: externalRef,
              invoice_number: invoiceNumber,
            };
          }

          // Create payment preference on Mercado Pago
          const siteUrl = process.env.SITE_URL || "";
          const isPublicUrl = siteUrl && !/localhost|127\.0\.0\.1/.test(siteUrl);
          const baseUrl = isPublicUrl ? siteUrl.replace(/\/+$/, "") : "";

          const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/mercadopago` : undefined;
          const successUrl = baseUrl
            ? `${baseUrl}/billing?status=approved&invoice_id=${invoice.id}`
            : undefined;
          const pendingUrl = baseUrl
            ? `${baseUrl}/billing?status=pending&invoice_id=${invoice.id}`
            : undefined;
          const failureUrl = baseUrl
            ? `${baseUrl}/billing?status=rejected&invoice_id=${invoice.id}`
            : undefined;

          console.log(`[MercadoPago Checkout] Generating preference for invoice ${invoice.invoice_number || invoice.id} env=${platformGatewayConfig.environment} token=${platformGatewayConfig.accessToken.slice(0,12)}`);

          const pref = await createPreference(platformGatewayConfig, {
            title: `Assinatura ${plan.name} (${invoice.invoice_number || invoice.id})`,
            amount: Number(invoice.amount),
            externalReference: invoice.external_reference,
            payerEmail: user.email || "billing@saas.com",
            webhookUrl,
            successUrl,
            pendingUrl,
            failureUrl,
          });

          // Save preference ID to invoice metadata or payments log
          const paymentId = crypto.randomUUID();
          await db.query(
            `INSERT INTO billing_payments (
              id, tenant_id, customer_id, subscription_id, invoice_id,
              provider, provider_preference_id, external_reference, status, amount, environment
            ) VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, ?, 'pending', ?, ?)`,
            [
              paymentId,
              user.tenantId,
              user.userId,
              sub.id,
              invoice.id,
              pref.id,
              invoice.external_reference,
              invoice.amount,
              platformGatewayConfig.environment,
            ],
          );

          await logSubscriptionEvent(
            user.tenantId,
            sub.id,
            "payment_pending",
            sub.status,
            sub.status,
            invoice.id,
            paymentId,
            { provider_preference_id: pref.id },
          );

          // In Sandbox, Checkout Pro uses sandbox_init_point
          const checkoutUrl = platformGatewayConfig.environment === "sandbox" ? pref.sandbox_init_point : pref.init_point;

          return new Response(
            JSON.stringify({
              success: true,
              invoiceId: invoice.id,
              checkoutUrl,
              preferenceId: pref.id,
              externalReference: invoice.external_reference,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          console.error("[Checkout Error]", err);
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
