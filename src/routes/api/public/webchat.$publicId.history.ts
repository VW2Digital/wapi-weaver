import { createFileRoute } from "@tanstack/react-router";
import { getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { getWebchatHistory } from "@/lib/webchat/history.service";

export const Route = createFileRoute("/api/public/webchat/$publicId/history")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin");
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "").trim();

        if (!publicId || !token) {
          return Response.json({ error: "publicId and session token are required" }, { status: 400 });
        }

        const session = await getWebchatSessionByToken(publicId, token, origin);
        if (!session) {
          return Response.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const before = url.searchParams.get("before") || null;

        const messages = await getWebchatHistory(session, limit, before);

        return Response.json(
          {
            messages,
            conversationId: session.conversationId,
          },
          {
            headers: {
              "Access-Control-Allow-Origin": origin || "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          },
        );
      },

      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin");
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },
  },
});
