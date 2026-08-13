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

          let payerEmail = user.email || payer?.email;
          if (!payerEmail) {
            const userRows = (await db.query("SELECT email FROM users WHERE id = ? LIMIT 1", [user.userId])) as any[];
            if (userRows.length > 0 && userRows[0].email) {
              payerEmail = userRows[0].email;
            }
          }

          if (!payerEmail) {
            return new Response(JSON.stringify({ error: "Dados do pagador (e-mail) são obrigatórios." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
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

          const siteUrl = process.env.SITE_URL || process.env.APP_URL || "";
          const isPublicUrl = siteUrl && !/localhost|127\.0\.0\.1/.test(siteUrl);
          const webhookUrl = isPublicUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago` : undefined;

          const paymentId = crypto.randomUUID();
          const idempotencyKey = paymentId;

          // 5. Persist local payment attempt BEFORE calling Mercado Pago
          await db.query(
            `INSERT INTO billing_payments (
              id, tenant_id, customer_id, subscription_id, invoice_id,
              provider, external_reference, payment_method, payment_type,
              status, amount, currency, installments, payer_email, environment
            ) VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, ?, 'credit_card', 'pending', ?, 'BRL', ?, ?, ?)`,
            [
              paymentId,
              user.tenantId,
              user.userId,
              sub.id,
              invoice.id,
              invoice.external_reference,
              payment_method_id,
              invoice.amount,
              installments ? Number(installments) : 1,
              payerEmail,
              platformGatewayConfig.environment,
            ]
          );

          const payload: Record<string, unknown> = {
            transaction_amount: Number(invoice.amount),
            token,
            description: `Renovação de Assinatura - ${billingPlan.name}`,
            payment_method_id,
            issuer_id: issuer_id ? Number(issuer_id) : undefined,
            installments: installments ? Number(installments) : 1,
            payer: {
              email: payerEmail,
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
          let mpResponse: any;
          try {
            mpResponse = await createPayment(platformGatewayConfig, {
              ...payload,
              idempotencyKey,
            });
          } catch (err: any) {
            await db.query(
              "UPDATE billing_payments SET status = 'failed', status_detail = ? WHERE id = ?",
              [err.message || "Mercado Pago API error", paymentId]
            );
            throw err;
          }

          const providerPaymentId = String(mpResponse.id);
          const paymentStatus = mpResponse.status || "rejected";
          const paymentStatusDetail = mpResponse.status_detail || null;

          // 6. Update payment record with provider response
          await db.query(
            `UPDATE billing_payments
             SET provider_payment_id = ?, status = ?, status_detail = ?, raw_response = ?
             WHERE id = ?`,
            [
              providerPaymentId,
              paymentStatus,
              paymentStatusDetail,
              JSON.stringify(mpResponse),
              paymentId,
            ]
          );

          // 7. If approved, process atomically in transaction
          if (paymentStatus === "approved") {
            const dateApproved = mpResponse.date_approved ? new Date(mpResponse.date_approved) : new Date();
            await db.transaction(async (conn) => {
              await processApprovedPayment(
                conn,
                providerPaymentId,
                dateApproved,
                invoice.amount,
                "BRL",
                mpResponse
              );
            });
          } else {
            await db.query("UPDATE billing_invoices SET status = 'failed' WHERE id = ?", [invoice.id]);
            await logSubscriptionEvent(
              user.tenantId,
              sub.id,
              "payment_failed",
              sub.status,
              sub.status,
              invoice.id,
              paymentId,
              { status: paymentStatus, status_detail: paymentStatusDetail }
            );
          }

          return new Response(
            JSON.stringify({
              success: paymentStatus === "approved",
              status: paymentStatus,
              statusDetail: paymentStatusDetail,
              paymentId,
              invoiceId: invoice.id,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[Card Checkout Error]", err);
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({ error: isAuthErr ? "Sessão expirada. Faça login novamente." : (err.message || "Não foi possível processar o pagamento com cartão. Tente novamente.") }), {
            status: isAuthErr ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
