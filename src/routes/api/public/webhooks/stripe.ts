import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { stripe } from "@/lib/stripe";
import db from "@/lib/db";

export const APIRoute = createAPIFileRoute("/api/public/webhooks/stripe")({
  POST: async ({ request }) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

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

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const customerId = session.customer;
          const subscriptionId = session.subscription;
          const clientEmail = session.customer_details?.email;
          const clientName = session.customer_details?.name || "Novo Cliente Stripe";

          // Se tiver um ID do cliente (tenant) vindo dos metadados, podemos mapear
          const tenantId = session.metadata?.tenantId;

          if (clientEmail) {
            // Check if there is an existing license
            const licenseRows = await db.query(
              "SELECT id FROM licenses WHERE client_email = ? LIMIT 1",
              [clientEmail]
            ) as any[];

            if (licenseRows.length > 0) {
              await db.query(
                `UPDATE licenses SET 
                 stripe_customer_id = ?, 
                 stripe_subscription_id = ?, 
                 status = 'active' 
                 WHERE client_email = ?`,
                [customerId, subscriptionId, clientEmail]
              );
            } else {
              // Creating a new license dynamically (Wait, we need a plan/key)
              // We'll leave it as payment success, but usually licenses are created earlier as 'pending'
            }
          }
          break;
        }

        case "customer.subscription.deleted":
        case "customer.subscription.paused": {
          const subscription = event.data.object as any;
          await db.query(
            "UPDATE licenses SET status = 'suspended' WHERE stripe_subscription_id = ?",
            [subscription.id]
          );
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          if (subscription.status === "active") {
            await db.query(
              "UPDATE licenses SET status = 'active' WHERE stripe_subscription_id = ?",
              [subscription.id]
            );
          } else if (subscription.status === "past_due") {
            // Optional: you can set it to suspended or a warning state
          }
          break;
        }
      }

      return json({ received: true });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});
