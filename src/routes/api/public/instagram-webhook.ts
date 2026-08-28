import { createFileRoute } from "@tanstack/react-router";
import { processInstagramWebhook } from "@/lib/messaging/webhook-handlers/instagram.handler";

export const Route = createFileRoute("/api/public/instagram-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token) {
          if (token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            return new Response(challenge ?? "", { status: 200 });
          }
        }

        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        return processInstagramWebhook(rawBody, sig);
      },
    },
  },
});
