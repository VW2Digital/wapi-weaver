// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription, logSubscriptionEvent, processApprovedPayment } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, createPayment } from "@/lib/mercadopago";
import { validateBillingPlan } from "@/lib/plan-validator";
import { addDays } from "date-fns";

export const Route = createFileRoute("/api/billing/checkout/card")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { planId, token, payment_method_id, issuer_id, installments, payer } = body;

          // planId sent by frontend represents billing_plans.id
          const billingPlanId = planId;

          if (!billingPlanId || !token || !payment_method_id) {
            return new Response(
              JSON.stringify({ error: "Parâmetros obrigatórios ausentes (planId, token, payment_method_id)." }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // 1. Fetch & validate commercial billing_plan joined with subscription_plans
          const planCheck = await validateBillingPlan(billingPlanId);

          if (!planCheck.exists || !planCheck.isActive || !planCheck.subscriptionPlanValid) {
            return new Response(
              JSON.stringify({ error: "O plano selecionado não está disponível ou está configurado incorretamente." }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const billingPlan = planCheck.billingPlan;

          // 2. Fetch or create tenant subscription
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

          // 3. Get platform Mercado Pago configuration
          let platformGatewayConfig = await getMercadoPagoConfig(user.tenantId).catch(() => null);
          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            platformGatewayConfig = await getMercadoPagoConfig("global").catch(() => null);
          }

          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            return new Response(
              JSON.stringify({ error: "O portal de pagamento do Mercado Pago não está configurado." }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // 4. Get or create invoice for this billing_plan
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
                `Renovação Cartão - ${billingPlan.name}`,
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
          const webhookUrl = isPublicUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago` : undefined;

          const paymentId = crypto.randomUUID();
          const idempotencyKey = paymentId;

          const payload: Record<string, unknown> = {
            transaction_amount: Number(invoice.amount),
            token,
            description: `Renovação de Assinatura - ${billingPlan.name}`,
            payment_method_id,
            issuer_id: issuer_id ? Number(issuer_id) : undefined,
            installments: installments ? Number(installments) : 1,
            payer: {
              email: payer?.email || user.email,
              identification: payer?.identification
                ? {
                    type: payer.identification.type,
                    number: payer.identification.number.replace(/\D/g, ""),
                  }
                : undefined,
            },
            ...(webhookUrl ? { notification_url: webhookUrl } : {}),
            external_reference: invoice.external_reference,
          };

          console.log(`[MercadoPago Card] Creating payment for invoice ${invoice.invoice_number} (Key: ${idempotencyKey})`);
          const mpResponse = await createPayment(platformGatewayConfig, {
            ...payload,
            idempotencyKey,
          });

          const providerPaymentId = String(mpResponse.id);

          // Save payment response in database
          await db.query(
            `INSERT INTO billing_payments (
              id, tenant_id, customer_id, subscription_id, invoice_id,
              provider, provider_payment_id, external_reference, payment_method, payment_type,
              status, status_detail, amount, currency, installments, payer_email, raw_response, environment
            ) VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, ?)`,
            [
              paymentId,
              user.tenantId,
              user.userId,
              sub.id,
              invoice.id,
              providerPaymentId,
              invoice.external_reference,
              payment_method_id,
              mpResponse.payment_type_id || "credit_card",
              mpResponse.status,
              mpResponse.status_detail || null,
              invoice.amount,
              installments || 1,
              payer?.email || user.email,
              JSON.stringify(mpResponse),
              platformGatewayConfig.environment,
            ]
          );

          await logSubscriptionEvent(
            user.tenantId,
            sub.id,
            `payment_${mpResponse.status}`,
            sub.status,
            sub.status,
            invoice.id,
            paymentId,
            { provider_payment_id: providerPaymentId, method: "card" }
          );

          // Process immediately if approved by Mercado Pago
          if (mpResponse.status === "approved") {
            console.log(`[MercadoPago Card] Payment immediately approved! Provisioning subscription...`);
            await db.transaction(async (conn) => {
              await processApprovedPayment(
                conn,
                providerPaymentId,
                new Date(mpResponse.date_approved || new Date()),
                Number(invoice.amount),
                "BRL",
                mpResponse
              );
            });

            return new Response(
              JSON.stringify({
                success: true,
                status: "approved",
                statusDetail: mpResponse.status_detail,
                invoiceId: invoice.id,
                paymentId,
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: false,
              status: mpResponse.status,
              statusDetail: mpResponse.status_detail,
              invoiceId: invoice.id,
              paymentId,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[Card Checkout Error]", err);
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({ error: isAuthErr ? "Sessão expirada. Faça login novamente." : (err.message || "Não foi possível processar o pagamento por cartão.") }), {
            status: isAuthErr ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
