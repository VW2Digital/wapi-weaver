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
          // Body empty or query-based
        }

        const { id: resourceId, type: eventType } = getEventDetails(body, url);

        if (!resourceId) {
          console.warn("[MercadoPago Alt Webhook] Received webhook without a resource ID.");
          return new Response(JSON.stringify({ message: "No resource ID found" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const eventId = `mp-alt:${resourceId}:${eventType}`;
        console.log(`[MercadoPago Alt Webhook] Received event. Type: ${eventType}, Resource ID: ${resourceId}`);

        // Safe payload sanitization
        const sanitizedBody = { ...body };
        if (sanitizedBody.card) {
          sanitizedBody.card = {
            last_four_digits: sanitizedBody.card.last_four_digits,
            cardholder: { name: sanitizedBody.card.cardholder?.name }
          };
        }
        delete sanitizedBody.access_token;
        delete sanitizedBody.client_secret;

        const payloadHash = crypto.createHash("sha256").update(JSON.stringify(sanitizedBody)).digest("hex");

        let existingEvent: any = null;
        const existingRows = await db.query(
          "SELECT * FROM billing_webhook_events WHERE event_id = ? AND provider = 'mercadopago' LIMIT 1",
          [eventId]
        ) as any[];

        if (existingRows.length > 0) {
          existingEvent = existingRows[0];
          const status = existingEvent.status;
          
          if (status === "processed" || status === "ignored") {
            console.log(`[MercadoPago Alt Webhook] Event ${eventId} already ${status}. Ignoring.`);
            return new Response(JSON.stringify({ success: true, message: `Event already ${status}` }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (status === "processing") {
            const startedAt = new Date(existingEvent.processing_started_at).getTime();
            const elapsed = Date.now() - startedAt;
            if (elapsed < 300_000) {
              console.log(`[MercadoPago Alt Webhook] Event ${eventId} is currently being processed. Skipping.`);
              return new Response(JSON.stringify({ success: true, message: "Event currently processing" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            console.warn(`[MercadoPago Alt Webhook] Event ${eventId} processing timed out. Taking over.`);
          }

          if (status === "failed") {
            if (existingEvent.attempts >= 3) {
              console.warn(`[MercadoPago Alt Webhook] Event ${eventId} failed maximum attempts (3).`);
              return new Response(JSON.stringify({ success: false, message: "Max attempts exceeded" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            const lastAttempt = new Date(existingEvent.processing_started_at || existingEvent.received_at).getTime();
            if (Date.now() - lastAttempt < 120_000) {
              console.log(`[MercadoPago Alt Webhook] Event ${eventId} failed recently. Waiting retry.`);
              return new Response(JSON.stringify({ success: true, message: "Retry interval active" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        }

        const eventUuid = existingEvent ? existingEvent.id : crypto.randomUUID();
        try {
          if (existingEvent) {
            const [updateRes] = await db.query(
              `UPDATE billing_webhook_events 
               SET status = 'processing', attempts = attempts + 1, processing_started_at = NOW() 
               WHERE id = ? AND status IN ('processing', 'failed')`,
              [eventUuid]
            );
            if (updateRes.affectedRows === 0) {
              return new Response(JSON.stringify({ success: true, message: "Concurrency lock missed" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          } else {
            await db.query(
              `INSERT INTO billing_webhook_events (
                id, provider, environment, event_id, event_type, resource_id, request_id, payload_hash, payload, status, attempts, processing_started_at
              ) VALUES (?, 'mercadopago', 'sandbox', ?, ?, ?, ?, ?, ?, 'processing', 1, NOW())`,
              [
                eventUuid,
                eventId,
                eventType,
                resourceId,
                requestId || null,
                payloadHash,
                JSON.stringify(sanitizedBody),
              ]
            );
          }
        } catch (err: any) {
          if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
            return new Response(JSON.stringify({ success: true, message: "Duplicate concurrent event ignored" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          console.error("[MercadoPago Alt Webhook] Error registering event:", err);
          return new Response(JSON.stringify({ error: "Database error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (eventType !== "payment") {
          console.log(`[MercadoPago Alt Webhook] Event type ${eventType} ignored.`);
          await db.query("UPDATE billing_webhook_events SET status = 'ignored' WHERE id = ?", [eventUuid]);
          return new Response(JSON.stringify({ success: true, message: "Event type ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        (async () => {
          try {
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

            console.log(`[MercadoPago Alt Webhook] Official payment status: ${status}, ExtRef: ${externalReference}`);

            const dbPayments = (await db.query(
              "SELECT id, tenant_id, invoice_id FROM billing_payments WHERE (provider_payment_id = ? OR external_reference = ?) AND provider = 'mercadopago' LIMIT 1",
              [resourceId, externalReference],
            )) as any[];

            if (dbPayments.length === 0) {
              console.warn(`[MercadoPago Alt Webhook] No matching payment record for reference: ${externalReference}`);
              await db.query(
                "UPDATE billing_webhook_events SET status = 'ignored', error_message = 'No billing payment record found' WHERE id = ?",
                [eventUuid],
              );
              return;
            }

            const dbPayment = dbPayments[0];

            const isLive = paymentDetails.live_mode;
            const actualEnv = isLive ? "production" : "sandbox";

            await db.query(
              `UPDATE billing_payments 
               SET provider_payment_id = ?, status = ?, status_detail = ?, raw_response = ?, environment = ? 
               WHERE id = ?`,
              [
                resourceId,
                status,
                paymentDetails.status_detail || null,
                JSON.stringify(paymentDetails),
                actualEnv,
                dbPayment.id,
              ],
            );

            await db.query(
              "UPDATE billing_webhook_events SET environment = ?, tenant_id = ?, invoice_id = ?, payment_id = ? WHERE id = ?",
              [actualEnv, dbPayment.tenant_id, dbPayment.invoice_id, dbPayment.id, eventUuid]
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
              "UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = ?",
              [eventUuid],
            );
          } catch (e: any) {
            console.error(`[MercadoPago Alt Webhook Process Error] Event ${eventUuid} failed:`, e);
            await db.query(
              "UPDATE billing_webhook_events SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?",
              [e.code || "PROCESSING_ERROR", e.message || String(e), eventUuid],
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
