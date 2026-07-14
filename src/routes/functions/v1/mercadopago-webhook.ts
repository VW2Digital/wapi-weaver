// @ts-nocheck
/**
 * Alternative Mercado Pago webhook endpoint.
 * URL: /functions/v1/mercadopago-webhook
 *
 * This route mirrors /api/webhooks/mercadopago exactly.
 * Use this URL as a fallback in the Mercado Pago dashboard notification settings.
 */
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import db from "@/lib/db";
import { processApprovedPayment } from "@/lib/subscription-helpers";
import { getMercadoPagoConfig, getPaymentDetails } from "@/lib/mercadopago";

function getEventDetails(body: any, url: URL): { id: string; type: string } {
  if (body?.data?.id) {
    return { id: String(body.data.id), type: body.type || "payment" };
  }
  if (body?.id && body?.type) {
    return { id: String(body.id), type: body.type };
  }
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const type = url.searchParams.get("type") || url.searchParams.get("topic") || "payment";
  if (dataId) {
    return { id: String(dataId), type };
  }
  return { id: "", type: "" };
}

export const Route = createFileRoute("/functions/v1/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const signature = request.headers.get("x-signature") || "";
        const requestId = request.headers.get("x-request-id") || "";

        let body: any = null;
        try {
          body = await request.json();
        } catch (e) {
          // Body might be empty or query-based
        }

        const { id: resourceId, type: eventType } = getEventDetails(body, url);

        if (!resourceId) {
          console.warn("[MercadoPago Alt Webhook] Received webhook without a resource ID.");
          return new Response(JSON.stringify({ message: "No resource ID found" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Use a different prefix for alt-webhook events to avoid duplicate key conflicts
        const eventId = `mp-alt:${resourceId}:${eventType}`;
        console.log(`[MercadoPago Alt Webhook] Received event. Type: ${eventType}, Resource ID: ${resourceId}`);

        try {
          await db.query(
            `INSERT INTO webhook_events (
              id, provider, environment, event_id, event_type, resource_id, request_id, signature, payload, status
            ) VALUES (?, 'mercadopago', 'sandbox', ?, ?, ?, ?, ?, ?, 'received')`,
            [
              crypto.randomUUID(),
              eventId,
              eventType,
              resourceId,
              requestId || null,
              signature || null,
              JSON.stringify(body || {}),
            ],
          );
        } catch (err: any) {
          if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
            console.log(`[MercadoPago Alt Webhook] Event ${eventId} already received. Responding 200.`);
            return new Response(JSON.stringify({ success: true, message: "Duplicate event ignored" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          console.error("[MercadoPago Alt Webhook] Database error registering event:", err);
          return new Response(JSON.stringify({ error: "Database error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (eventType !== "payment") {
          console.log(`[MercadoPago Alt Webhook] Event type is ${eventType}, not payment. Ignoring.`);
          await db.query("UPDATE webhook_events SET status = 'ignored' WHERE event_id = ?", [eventId]);
          return new Response(JSON.stringify({ success: true, message: "Event type ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        (async () => {
          try {
            await db.query("UPDATE webhook_events SET status = 'processing', attempts = attempts + 1 WHERE event_id = ?", [eventId]);

            const payments = (await db.query(
              "SELECT tenant_id FROM billing_payments WHERE provider_payment_id = ? AND provider = 'mercadopago' LIMIT 1",
              [resourceId],
            )) as any[];

            let tenantId = "global";
            if (payments.length > 0) {
              tenantId = payments[0].tenant_id;
            }

            let config = await getMercadoPagoConfig(tenantId);
            if (!config || !config.accessToken) {
              config = await getMercadoPagoConfig("global");
            }

            if (!config || !config.accessToken) {
              throw new Error("No active credentials found to fetch payment details.");
            }

            const paymentDetails = await getPaymentDetails(config, resourceId);
            const externalReference = paymentDetails.external_reference;
            const status = paymentDetails.status;
            const amount = Number(paymentDetails.transaction_amount);
            const currency = paymentDetails.currency_id;
            const dateApproved = paymentDetails.date_approved ? new Date(paymentDetails.date_approved) : new Date();

            const isLive = paymentDetails.live_mode;
            const actualEnv = isLive ? "production" : "sandbox";
            await db.query("UPDATE webhook_events SET environment = ? WHERE event_id = ?", [actualEnv, eventId]);

            const dbPayments = (await db.query(
              "SELECT id, tenant_id, invoice_id FROM billing_payments WHERE (provider_payment_id = ? OR external_reference = ?) AND provider = 'mercadopago' LIMIT 1",
              [resourceId, externalReference],
            )) as any[];

            if (dbPayments.length === 0) {
              console.warn(`[MercadoPago Alt Webhook] No matching payment record for reference: ${externalReference}`);
              await db.query(
                "UPDATE webhook_events SET status = 'ignored', error_message = 'No billing payment record found' WHERE event_id = ?",
                [eventId],
              );
              return;
            }

            const dbPayment = dbPayments[0];

            await db.query(
              `UPDATE billing_payments 
               SET provider_payment_id = ?, status = ?, status_detail = ?, raw_response = ? 
               WHERE id = ?`,
              [
                resourceId,
                status,
                paymentDetails.status_detail || null,
                JSON.stringify(paymentDetails),
                dbPayment.id,
              ],
            );

            if (status === "approved") {
              await db.transaction(async (conn) => {
                await processApprovedPayment(conn, resourceId, dateApproved, amount, currency, paymentDetails);
              });
              console.log(`[MercadoPago Alt Webhook] Payment approved and processed for payment: ${resourceId}`);
            } else if (status === "rejected" || status === "cancelled" || status === "refunded") {
              const invoiceStatus = status === "refunded" ? "refunded" : "failed";
              await db.query("UPDATE billing_invoices SET status = ? WHERE id = ?", [invoiceStatus, dbPayment.invoice_id]);
            }

            await db.query(
              "UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE event_id = ?",
              [eventId],
            );
          } catch (e: any) {
            console.error(`[MercadoPago Alt Webhook Process Error] Event ${eventId} failed:`, e);
            await db.query(
              "UPDATE webhook_events SET status = 'failed', error_message = ? WHERE event_id = ?",
              [e.message || String(e), eventId],
            );
          }
        })();

        return new Response(JSON.stringify({ success: true, message: "Webhook received" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
