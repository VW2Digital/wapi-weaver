// @ts-nocheck
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

function verifyMercadoPagoSignature(
  signatureHeader: string,
  requestId: string,
  dataId: string,
  secret: string
): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",");
  let ts = "";
  let v1 = "";

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    const computedBuffer = Buffer.from(computedHash.toLowerCase(), "utf8");
    const v1Buffer = Buffer.from(v1.toLowerCase(), "utf8");
    if (computedBuffer.length !== v1Buffer.length) return false;
    return crypto.timingSafeEqual(computedBuffer, v1Buffer);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/webhooks/mercadopago")({
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
          console.warn("[MercadoPago Webhook] Received webhook without a resource ID.");
          return new Response(JSON.stringify({ message: "No resource ID found" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Validate webhook signature: when secret is configured, signature is STRICTLY REQUIRED
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "";
        if (webhookSecret) {
          const isValid = verifyMercadoPagoSignature(signature, requestId, resourceId, webhookSecret);
          if (!isValid) {
            console.warn(`[MercadoPago Webhook] Invalid or missing signature for event resource: ${resourceId}`);
            return new Response(JSON.stringify({ error: "Invalid or missing webhook signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // Deduplication event ID based on unique request or resource + action/event
        const eventId = requestId ? `mp:${resourceId}:${requestId}` : `mp:${resourceId}:${Date.now()}`;
        console.log(`[MercadoPago Webhook] Received event. Type: ${eventType}, Resource ID: ${resourceId}`);

        // Safe payload sanitization
        const sanitizedBody = { ...body };
        if (sanitizedBody.card) {
          sanitizedBody.card = {
            last_four_digits: sanitizedBody.card.last_four_digits,
            cardholder: { name: sanitizedBody.card.cardholder?.name },
          };
        }
        delete sanitizedBody.access_token;
        delete sanitizedBody.client_secret;

        const payloadHash = crypto.createHash("sha256").update(JSON.stringify(sanitizedBody)).digest("hex");

        let existingEvent: any = null;
        const existingRows = (await db.query(
          "SELECT * FROM billing_webhook_events WHERE event_id = ? AND provider = 'mercadopago' LIMIT 1",
          [eventId]
        )) as any[];

        if (existingRows.length > 0) {
          existingEvent = existingRows[0];
          const status = existingEvent.status;

          if (status === "processed" || status === "ignored") {
            console.log(`[MercadoPago Webhook] Event ${eventId} already ${status}. Ignoring.`);
            return new Response(JSON.stringify({ success: true, message: `Event already ${status}` }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // Atomic registration of webhook event
        const eventUuid = existingEvent ? existingEvent.id : crypto.randomUUID();
        try {
          if (!existingEvent) {
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
            console.log(`[MercadoPago Webhook] Concurrent insertion race for ${eventId}. Aborting duplicate.`);
            return new Response(JSON.stringify({ success: true, message: "Duplicate concurrent event ignored" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        if (eventType !== "payment") {
          console.log(`[MercadoPago Webhook] Event type ${eventType} ignored.`);
          await db.query("UPDATE billing_webhook_events SET status = 'ignored' WHERE id = ?", [eventUuid]);
          return new Response(JSON.stringify({ success: true, message: "Event type ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Process webhook synchronously to guarantee database consistency and prevent serverless teardown races
        try {
          const payments = (await db.query(
            "SELECT tenant_id FROM billing_payments WHERE provider_payment_id = ? AND provider = 'mercadopago' LIMIT 1",
            [resourceId]
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

          // Query official details from Mercado Pago API as SOURCE OF TRUTH
          const paymentDetails = await getPaymentDetails(config, resourceId);

          const externalReference = paymentDetails.external_reference;
          const status = paymentDetails.status;
          const amount = Number(paymentDetails.transaction_amount);
          const currency = paymentDetails.currency_id || "BRL";
          const dateApproved = paymentDetails.date_approved ? new Date(paymentDetails.date_approved) : new Date();

          console.log(`[MercadoPago Webhook] Official payment status: ${status}, ExtRef: ${externalReference}`);

          const dbPayments = (await db.query(
            "SELECT id, tenant_id, invoice_id FROM billing_payments WHERE (provider_payment_id = ? OR external_reference = ?) AND provider = 'mercadopago' LIMIT 1",
            [resourceId, externalReference]
          )) as any[];

          if (dbPayments.length === 0) {
            console.warn(`[MercadoPago Webhook] No matching billing_payments record for ${externalReference}`);
            await db.query(
              "UPDATE billing_webhook_events SET status = 'ignored', error_message = 'No billing payment record found' WHERE id = ?",
              [eventUuid]
            );
            return new Response(JSON.stringify({ success: true, message: "No matching payment record found" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const dbPayment = dbPayments[0];
          const isLive = Boolean(paymentDetails.live_mode);
          const actualEnv = isLive ? "production" : "sandbox";

          // DO NOT mark payment as approved here. Let processApprovedPayment atomically update payment + invoice + subscription in transaction
          await db.query(
            "UPDATE billing_webhook_events SET environment = ?, tenant_id = ?, invoice_id = ?, payment_id = ? WHERE id = ?",
            [actualEnv, dbPayment.tenant_id, dbPayment.invoice_id, dbPayment.id, eventUuid]
          );

          // Handle approved payment atomically inside transaction
          if (status === "approved") {
            await db.transaction(async (conn) => {
              await processApprovedPayment(
                conn,
                resourceId,
                dateApproved,
                amount,
                currency,
                paymentDetails
              );
            });
            console.log(`[MercadoPago Webhook] Payment approved and provisioned for: ${resourceId}`);
          } else if (status === "rejected" || status === "cancelled" || status === "refunded") {
            const invoiceStatus = status === "refunded" ? "refunded" : "failed";
            await db.query("UPDATE billing_invoices SET status = ? WHERE id = ?", [
              invoiceStatus,
              dbPayment.invoice_id,
            ]);
            await db.query("UPDATE billing_payments SET status = ? WHERE id = ?", [
              status,
              dbPayment.id,
            ]);
            console.log(`[MercadoPago Webhook] Payment status updated to ${status} for: ${resourceId}`);
          }

          await db.query(
            "UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = ?",
            [eventUuid]
          );

          return new Response(JSON.stringify({ success: true, message: `Webhook processed successfully (Status: ${status})` }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error(`[MercadoPago Webhook Process Error] Event ${eventUuid} failed:`, e);
          await db.query(
            "UPDATE billing_webhook_events SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?",
            [e.code || "PROCESSING_ERROR", e.message || String(e), eventUuid]
          );

          // Return HTTP 500 for transient internal failures so Mercado Pago can retry
          return new Response(JSON.stringify({ error: "Ocorreu uma falha no processamento interno da notificação." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
