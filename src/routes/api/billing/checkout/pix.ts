// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { verifyApiUser, getOrCreateSubscription, logSubscriptionEvent } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, createPayment } from "@/lib/mercadopago";
import { addDays, addMinutes } from "date-fns";

export const Route = createFileRoute("/api/billing/checkout/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          const body = await request.json();
          const { planId, payer } = body;

          if (!planId) {
            return new Response(JSON.stringify({ error: "O identificador do plano é obrigatório." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!payer || !payer.email) {
            return new Response(JSON.stringify({ error: "Dados do pagador (e-mail) são obrigatórios." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch & validate plan safely
          const { validateOrRejectPlan } = await import("@/lib/plan-validator");
          const planValidation = await validateOrRejectPlan(planId, {
            userId: user.userId,
            tenantId: user.tenantId,
            operation: "checkout_pix_initiation",
            source: "checkout_pix_route",
          });

          if (!planValidation.valid && planValidation.response) {
            return planValidation.response;
          }

          const plan = planValidation.planResult?.plan;

          // Fetch subscription
          const sub = await getOrCreateSubscription(user.tenantId, user.userId);

          // Get Mercado Pago Config — try tenant first, then fall back to any row (platform-wide config)
          let platformGatewayConfig = await getMercadoPagoConfig(user.tenantId).catch(() => null);
          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            platformGatewayConfig = await getMercadoPagoConfig("__any__").catch(() => null);
          }

          console.log(`[PIX Checkout] env=${platformGatewayConfig?.environment} token_prefix=${platformGatewayConfig?.accessToken?.slice(0,10)}`);

          if (!platformGatewayConfig || !platformGatewayConfig.accessToken) {
            return new Response(
              JSON.stringify({ error: "O portal de pagamento do Mercado Pago não está configurado." }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Get or create pending invoice
          const existingInvoices = (await db.query(
            "SELECT * FROM billing_invoices WHERE tenant_id = ? AND plan_id = ? AND status = 'pending' LIMIT 1",
            [user.tenantId, planId],
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
                plan.id,
                invoiceNumber,
                `Renovação PIX - ${plan.name}`,
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

          // Check if there is already an active pending PIX payment for this invoice that has not expired
          const existingPayments = (await db.query(
            "SELECT * FROM billing_payments WHERE invoice_id = ? AND status = 'pending' AND payment_method = 'pix' AND expires_at > NOW() LIMIT 1",
            [invoice.id],
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
                },
              );
            }
          }

          // Generate new PIX payment on Mercado Pago
          const siteUrl = process.env.SITE_URL || "";
          const isPublicUrl = siteUrl && !/localhost|127\.0\.0\.1/.test(siteUrl);
          const webhookUrl = isPublicUrl ? `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago` : undefined;
          
          const idempotencyKey = crypto.randomUUID();
          
          const payload: Record<string, unknown> = {
            transaction_amount: Number(invoice.amount),
            description: `Renovação de Assinatura - ${plan.name}`,
            payment_method_id: "pix",
            payer: {
              email: payer.email,
              first_name: payer.first_name || user.email.split("@")[0] || "Cliente",
              last_name: payer.last_name || "SaaS",
              identification: payer.identification?.number
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

          console.log(`[MercadoPago PIX] Creating payment request for ${invoice.invoice_number}`);
          const mpResponse = await createPayment(platformGatewayConfig, {
            ...payload,
            idempotencyKey,
          });

          const providerPaymentId = String(mpResponse.id);
          const qrCode = mpResponse.point_of_interaction?.transaction_data?.qr_code;
          const qrCodeBase64 = mpResponse.point_of_interaction?.transaction_data?.qr_code_base64;
          const paymentExpiresAt = mpResponse.date_of_expiration ? new Date(mpResponse.date_of_expiration) : addMinutes(new Date(), 30);

          // Save payment
          const paymentId = crypto.randomUUID();
          await db.query(
            `INSERT INTO billing_payments (
              id, tenant_id, customer_id, subscription_id, invoice_id,
              provider, provider_payment_id, external_reference, payment_method, payment_type,
              status, status_detail, amount, currency, payer_email, expires_at, raw_response, environment
            ) VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, ?, 'pix', 'ticket', ?, ?, ?, 'BRL', ?, ?, ?, ?)`,
            [
              paymentId,
              user.tenantId,
              user.userId,
              sub.id,
              invoice.id,
              providerPaymentId,
              invoice.external_reference,
              mpResponse.status,
              mpResponse.status_detail,
              invoice.amount,
              payer.email,
              paymentExpiresAt,
              JSON.stringify(mpResponse),
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
            { provider_payment_id: providerPaymentId, method: "pix" },
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
            },
          );
        } catch (err: any) {
          console.error("[PIX Checkout Error]", err);
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
