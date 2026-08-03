import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { transitionSubscriptionState, isGatewayEventProcessed } from "@/lib/subscription-state-machine";

export const Route = createFileRoute("/api/webhooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const eventType = body?.event;
          const payment = body?.payment || {};
          const eventId = body?.id || payment?.id || request.headers.get("asaas-request-id");

          if (!eventType || !eventId) {
            return new Response(JSON.stringify({ error: "Payload do Asaas inválido ou sem evento ID." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          console.log(`[Asaas Webhook] Evento recebido: ${eventType}, ID: ${eventId}`);

          // 1. Idempotência estrita: verificar se evento já foi processado
          const alreadyProcessed = await isGatewayEventProcessed("asaas", eventId);
          if (alreadyProcessed) {
            console.log(`[Asaas Webhook] Evento duplicado ${eventId} ignorado.`);
            return new Response(JSON.stringify({ success: true, message: "Evento duplicado já processado" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 2. Mapear o gateway_event_id e external reference
          const providerPaymentId = payment.id || eventId;
          const externalReference = payment.externalReference || payment.customer;

          // Buscar a assinatura correspondente pelo customer_id ou id da assinatura
          let subscriptionId: string | null = null;

          if (externalReference) {
            const subs = (await db.query(
              "SELECT id FROM subscriptions WHERE tenant_id = ? OR customer_id = ? LIMIT 1",
              [externalReference, externalReference]
            )) as any[];
            if (subs.length > 0) {
              subscriptionId = subs[0].id;
            }
          }

          if (!subscriptionId && payment.subscription) {
            const subs = (await db.query(
              "SELECT id FROM subscriptions WHERE customer_id = ? LIMIT 1",
              [payment.subscription]
            )) as any[];
            if (subs.length > 0) {
              subscriptionId = subs[0].id;
            }
          }

          if (!subscriptionId) {
            console.warn(`[Asaas Webhook] Nenhuma assinatura vinculada encontrada para ref: ${externalReference || payment.subscription}`);
            return new Response(JSON.stringify({ success: true, message: "Assinatura não vinculada" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 3. Processar estados de transição da máquina de estados
          if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
            await transitionSubscriptionState(subscriptionId, "active", {
              source: "asaas",
              gateway_event_id: eventId,
              raw_payload: body,
              event_timestamp: body.dateCreated || new Date(),
            });
          } else if (eventType === "PAYMENT_OVERDUE") {
            await transitionSubscriptionState(subscriptionId, "past_due", {
              source: "asaas",
              gateway_event_id: eventId,
              raw_payload: body,
              event_timestamp: body.dateCreated || new Date(),
              grace_period_days: 3,
            });
          } else if (eventType === "SUBSCRIPTION_CANCELLED" || eventType === "PAYMENT_DELETED") {
            await transitionSubscriptionState(subscriptionId, "cancelled", {
              source: "asaas",
              gateway_event_id: eventId,
              raw_payload: body,
              event_timestamp: body.dateCreated || new Date(),
            });
          }

          return new Response(JSON.stringify({ success: true, message: "Webhook Asaas processado com sucesso" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[Asaas Webhook Error]:", e);
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
