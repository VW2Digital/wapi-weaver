import { createFileRoute } from "@tanstack/react-router";
import {
  processInstagramWebhook,
  verifyInstagramWebhookSubscription,
} from "@/lib/messaging/webhook-handlers/instagram.handler";

export const Route = createFileRoute("/api/public/instagram-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        return verifyInstagramWebhookSubscription(mode, token, challenge);
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        return processInstagramWebhook(rawBody, sig);
      },
    },
  },
});
