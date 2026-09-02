import { createFileRoute } from "@tanstack/react-router";
import { getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { handleWebchatInboundMessage } from "@/lib/webchat/inbound-message.service";
import { checkMessageRateLimit } from "@/lib/webchat/rate-limit.service";

export const Route = createFileRoute("/api/public/webchat/$publicId/messages")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin");
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "").trim();

        if (!publicId || !token) {
          return Response.json({ error: "publicId and session token are required" }, { status: 400 });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const session = await getWebchatSessionByToken(publicId, token, origin);
        if (!session) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const allowed = await checkMessageRateLimit(session.id, request, publicId);
        if (!allowed) {
          return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        try {
          const result = await handleWebchatInboundMessage(session, body.clientMessageId, body.text);
          return Response.json(
            {
              messageId: result.messageId,
              conversationId: result.conversationId,
              clientMessageId: result.clientMessageId,
              duplicate: result.duplicate,
              botTriggered: result.botTriggered,
            },
            {
              headers: {
                "Access-Control-Allow-Origin": origin || "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            },
          );
        } catch (error: any) {
          const status = error.statusCode || 500;
          return Response.json({ error: error.message || "Failed to process message" }, { status });
        }
      },

      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin");
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },
  },
});
