import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { stripe } from "@/lib/stripe";
import db from "@/lib/db";
import crypto from "crypto";

export const APIRoute = createAPIFileRoute("/api/public/webhooks/stripe")({
  POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("No signature", { status: 400 });
        }

        // Capture raw original body bytes before parsing
        const payload = await request.text();
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;
        try {
          if (secret) {
            event = stripe.webhooks.constructEvent(payload, signature, secret);
          } else {
            event = JSON.parse(payload);
          }
        } catch (err: any) {
          console.error("Stripe webhook verification failed", err);
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }

        const eventId = `stripe:${event.id}`;
        const eventType = event.type;
        console.log(`[Stripe Webhook] Received event. Type: ${eventType}, ID: ${event.id}`);

        // Sanitization: exclude secret credentials
        const sanitizedObj = event.data?.object ? { ...event.data.object } : {};
        if (sanitizedObj.card) {
          sanitizedObj.card = {
            last4: sanitizedObj.card.last4,
            brand: sanitizedObj.card.brand,
          };
        }

        const payloadHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(sanitizedObj))
          .digest("hex");

        let existingEvent: any = null;
        const existingRows = (await db.query(
          "SELECT * FROM billing_webhook_events WHERE event_id = ? AND provider = 'stripe' LIMIT 1",
          [eventId],
        )) as any[];

        if (existingRows.length > 0) {
          existingEvent = existingRows[0];
          const status = existingEvent.status;

          if (status === "processed" || status === "ignored") {
            console.log(`[Stripe Webhook] Event ${eventId} already processed. Ignoring.`);
            return json({ received: true });
          }

          if (status === "processing") {
            const startedAt = new Date(existingEvent.processing_started_at).getTime();
            if (Date.now() - startedAt < 300_000) {
              console.log(
                `[Stripe Webhook] Event ${eventId} is currently being processed. Skipping.`,
              );
              return json({ received: true });
            }
          }

          if (status === "failed") {
            if (existingEvent.attempts >= 3) {
              return new Response("Max attempts exceeded", { status: 200 });
            }
            const lastAttempt = new Date(
              existingEvent.processing_started_at || existingEvent.received_at,
            ).getTime();
            if (Date.now() - lastAttempt < 120_000) {
              return json({ received: true });
            }
          }
        }

        const eventUuid = existingEvent ? existingEvent.id : crypto.randomUUID();
        const env = process.env.PAYMENT_ENVIRONMENT === "production" ? "production" : "sandbox";

        try {
          if (existingEvent) {
            const [updateRes] = await db.query(
              `UPDATE billing_webhook_events 
           SET status = 'processing', attempts = attempts + 1, processing_started_at = NOW() 
           WHERE id = ? AND status IN ('processing', 'failed')`,
              [eventUuid],
            );
            if (updateRes.affectedRows === 0) {
              return json({ received: true });
            }
          } else {
            await db.query(
              `INSERT INTO billing_webhook_events (
            id, provider, environment, event_id, event_type, resource_id, payload_hash, payload, status, attempts, processing_started_at
          ) VALUES (?, 'stripe', ?, ?, ?, ?, ?, ?, 'processing', 1, NOW())`,
              [
                eventUuid,
                env,
                eventId,
                eventType,
                event.id,
                payloadHash,
                JSON.stringify(sanitizedObj),
              ],
            );
          }
        } catch (err: any) {
          if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
            return json({ received: true });
          }
          return new Response("Database error", { status: 500 });
        }

        try {
          switch (eventType) {
            case "checkout.session.completed": {
              const session = event.data.object as any;
              const customerId = session.customer;
              const subscriptionId = session.subscription;
              const clientEmail = session.customer_details?.email;

              const tenantId = session.metadata?.tenantId;

              if (clientEmail) {
                const licenseRows = (await db.query(
                  "SELECT id, status FROM licenses WHERE client_email = ? LIMIT 1",
                  [clientEmail],
                )) as any[];

                if (licenseRows.length > 0) {
                  const currentStatus = licenseRows[0].status;
                  // Transition validation logic
                  if (currentStatus !== "active") {
                    await db.query(
                      `UPDATE licenses SET 
                   stripe_customer_id = ?, 
                   stripe_subscription_id = ?, 
                   status = 'active' 
                   WHERE client_email = ?`,
                      [customerId, subscriptionId, clientEmail],
                    );
                  }
                }
              }
              break;
            }

            case "customer.subscription.deleted":
            case "customer.subscription.paused": {
              const subscription = event.data.object as any;
              await db.query(
                "UPDATE licenses SET status = 'suspended' WHERE stripe_subscription_id = ?",
                [subscription.id],
              );
              break;
            }

            case "customer.subscription.updated": {
              const subscription = event.data.object as any;
              if (subscription.status === "active") {
                await db.query(
                  "UPDATE licenses SET status = 'active' WHERE stripe_subscription_id = ?",
                  [subscription.id],
                );
              } else if (subscription.status === "past_due") {
                await db.query(
                  "UPDATE licenses SET status = 'suspended' WHERE stripe_subscription_id = ?",
                  [subscription.id],
                );
              }
              break;
            }
          }

          await db.query(
            "UPDATE billing_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = ?",
            [eventUuid],
          );

          return json({ received: true });
        } catch (error: any) {
          console.error("Error processing Stripe webhook:", error);
          await db.query(
            "UPDATE billing_webhook_events SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?",
            ["PROCESSING_ERROR", error.message || String(error), eventUuid],
          );
          return new Response("Internal Server Error", { status: 500 });
        }
  },
});
