// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription, logSubscriptionEvent } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, createPreference } from "@/lib/mercadopago";
import { validateOrRejectBillingPlan } from "@/lib/plan-validator";
import { addDays } from "date-fns";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { planId } = body;

          const billingPlanId = planId;

          if (!billingPlanId) {
            return new Response(JSON.stringify({ error: "O identificador do plano é obrigatório." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch & validate commercial billing_plan joined with subscription_plans
          const planValidation = await validateOrRejectBillingPlan(billingPlanId, {
            userId: user.userId,
            tenantId: user.tenantId,
            operation: "checkout_initiation",
            source: "checkout_route",
          });

          if (!planValidation.valid && planValidation.response) {
            return planValidation.response;
          }

          const billingPlan = planValidation.billingPlanResult?.billingPlan;
          if (!billingPlan) {
            return new Response(
              JSON.stringify({ error: "O plano selecionado não está disponível." }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Fetch or create subscription for tenant
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

          // Get platform Mercado Pago Config
          let platformGatewayConfig = await getMercadoPagoConfig(user.tenantId).catch(() => null);
          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            platformGatewayConfig = await getMercadoPagoConfig("global").catch(() => null);
          }

          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            return new Response(
              JSON.stringify({ error: "O portal de pagamento do Mercado Pago não está configurado na plataforma." }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Re-use existing pending invoice for this plan if valid
          const existingInvoices = (await db.query(
            "SELECT * FROM billing_invoices WHERE tenant_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1",
            [user.tenantId, billingPlan.id]
          )) as any[];

          let invoice: any;
          if (existingInvoices.length > 0) {
            invoice = existingInvoices[0];
          } else {
            const invoiceId = crypto.randomUUID();
            const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const externalRef = `invoice:${crypto.randomUUID()}`;
            const dueAt = addDays(new Date(), 3);

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
                billingPlan.id,
                invoiceNumber,
                `Renovação de Assinatura - ${billingPlan.name}`,
                billingPlan.price,
                dueAt,
                externalRef,
              ]
            );

            await logSubscriptionEvent(user.tenantId, sub.id, "invoice_created", sub.status, sub.status, invoiceId);

            invoice = {
              id: invoiceId,
              amount: billingPlan.price,
              external_reference: externalRef,
              invoice_number: invoiceNumber,
            };
          }

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

          console.log(`[MercadoPago Checkout] Generating preference for invoice ${invoice.invoice_number || invoice.id} env=${platformGatewayConfig.environment}`);

          const pref = await createPreference(platformGatewayConfig, {
            title: `Assinatura ${billingPlan.name} (${invoice.invoice_number || invoice.id})`,
            amount: Number(invoice.amount),
            externalReference: invoice.external_reference,
            payerEmail: user.email || "billing@saas.com",
            webhookUrl,
            successUrl,
            pendingUrl,
            failureUrl,
          });

          // Save preference ID to payments log
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
            ]
          );

          const checkoutUrl =
            platformGatewayConfig.environment === "production" ? pref.init_point : pref.sandbox_init_point || pref.init_point;

          return new Response(
            JSON.stringify({
              success: true,
              checkoutUrl,
              preferenceId: pref.id,
              invoiceId: invoice.id,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[Checkout Error]", err);
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({ error: isAuthErr ? "Sessão expirada. Faça login novamente." : (err.message || "Não foi possível iniciar o checkout.") }), {
            status: isAuthErr ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
