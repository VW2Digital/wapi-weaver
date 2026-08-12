// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription, logSubscriptionEvent } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, createPayment } from "@/lib/mercadopago";
import { validateBillingPlan } from "@/lib/plan-validator";
import { addDays, addMinutes } from "date-fns";

export const Route = createFileRoute("/api/billing/checkout/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { planId, payer } = body;

          const billingPlanId = planId;

          if (!billingPlanId) {
            return new Response(JSON.stringify({ error: "O identificador do plano é obrigatório." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Payer email must come from verified authenticated user
          const payerEmail = user.email || payer?.email;
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

          // 4. Get or create pending invoice for this billing_plan
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
                `Renovação PIX - ${billingPlan.name}`,
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

          // 5. Check if an active pending PIX payment exists for this invoice that has not expired
          const existingPayments = (await db.query(
            "SELECT * FROM billing_payments WHERE invoice_id = ? AND status = 'pending' AND payment_method = 'pix' AND expires_at > NOW() LIMIT 1",
            [invoice.id]
          )) as any[];

          if (existingPayments.length > 0) {
            const pm = existingPayments[0];
            const raw = typeof pm.raw_response === "string" ? JSON.parse(pm.raw_response) : pm.raw_response;
            const transactionData = raw?.point_of_interaction?.transaction_data;
            if (transactionData) {
              return new Response(
                JSON.stringify({
                  success: true,
                  invoiceId: invoice.id,
                  paymentId: pm.id,
                  qrCode: transactionData.qr_code,
                  qrCodeBase64: transactionData.qr_code_base64,
                  copiaCola: transactionData.qr_code,
                  expiresAt: pm.expires_at,
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          }

          // 6. PERSIST local payment attempt BEFORE calling Mercado Pago to guarantee retry protection
          const paymentId = crypto.randomUUID();
          const idempotencyKey = paymentId;
          const initialExpiresAt = addMinutes(new Date(), 30);

          await db.query(
            `INSERT INTO billing_payments (
              id, tenant_id, customer_id, subscription_id, invoice_id,
              provider, external_reference, payment_method, payment_type,
              status, amount, currency, payer_email, expires_at, environment
            ) VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, 'pix', 'ticket', 'pending', ?, 'BRL', ?, ?, ?)`,
            [
              paymentId,
              user.tenantId,
              user.userId,
              sub.id,
              invoice.id,
              invoice.external_reference,
              invoice.amount,
              payerEmail,
              initialExpiresAt,
              platformGatewayConfig.environment,
            ]
          );

          // 7. Generate new PIX payment on Mercado Pago with persistent Idempotency Key
          const siteUrl = process.env.SITE_URL || "";
          const isPublicUrl = siteUrl && !/localhost|127\.0\.0\.1/.test(siteUrl);
          const webhookUrl = isPublicUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago` : undefined;

          const payload: Record<string, unknown> = {
            transaction_amount: Number(invoice.amount),
            description: `Renovação de Assinatura - ${billingPlan.name}`,
            payment_method_id: "pix",
            payer: {
              email: payerEmail,
              first_name: payer?.first_name || user.email.split("@")[0] || "Cliente",
              last_name: payer?.last_name || "SaaS",
              identification: payer?.identification?.number
                ? {
                    type: payer.identification.type || "CPF",
                    number: payer.identification.number.replace(/\D/g, ""),
                  }
                : undefined,
            },
            ...(webhookUrl ? { notification_url: webhookUrl } : {}),
            external_reference: invoice.external_reference,
            installments: 1,
          };

          console.log(`[MercadoPago PIX] Calling API for invoice ${invoice.invoice_number} (Key: ${idempotencyKey})`);
          let mpResponse: any;
          try {
            mpResponse = await createPayment(platformGatewayConfig, {
              ...payload,
              idempotencyKey,
            });
          } catch (err: any) {
            // Update local payment record to failed status on API error
            await db.query(
              "UPDATE billing_payments SET status = 'failed', status_detail = ? WHERE id = ?",
              [err.message || "Mercado Pago API error", paymentId]
            );
            throw err;
          }

          const providerPaymentId = String(mpResponse.id);
          const qrCode = mpResponse.point_of_interaction?.transaction_data?.qr_code;
          const qrCodeBase64 = mpResponse.point_of_interaction?.transaction_data?.qr_code_base64;
          const paymentExpiresAt = mpResponse.date_of_expiration ? new Date(mpResponse.date_of_expiration) : initialExpiresAt;

          // 8. Update local payment record with provider response
          await db.query(
            `UPDATE billing_payments 
             SET provider_payment_id = ?, status = ?, status_detail = ?, expires_at = ?, raw_response = ?
             WHERE id = ?`,
            [
              providerPaymentId,
              mpResponse.status || "pending",
              mpResponse.status_detail || null,
              paymentExpiresAt,
              JSON.stringify(mpResponse),
              paymentId,
            ]
          );

          await logSubscriptionEvent(
            user.tenantId,
            sub.id,
            "payment_pending",
            sub.status,
            sub.status,
            invoice.id,
            paymentId,
            { provider_payment_id: providerPaymentId, method: "pix" }
          );

          return new Response(
            JSON.stringify({
              success: true,
              invoiceId: invoice.id,
              paymentId,
              qrCode,
              qrCodeBase64,
              copiaCola: qrCode,
              expiresAt: paymentExpiresAt,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          console.error("[PIX Checkout Error]", err);
          const isAuthErr = err.message?.toLowerCase().includes("unauthorized");
          return new Response(JSON.stringify({ error: isAuthErr ? "Sessão expirada. Faça login novamente." : (err.message || "Não foi possível iniciar o pagamento. Tente novamente.") }), {
            status: isAuthErr ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
