import { createFileRoute } from "@tanstack/react-router";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";
import { checkSessionCreationRateLimit } from "@/lib/webchat/rate-limit.service";

export const Route = createFileRoute("/api/public/webchat/$publicId/session")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin");

        if (!publicId) {
          return Response.json({ error: "publicId is required" }, { status: 400 });
        }

        const allowed = await checkSessionCreationRateLimit(publicId, request);
        if (!allowed) {
          return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          /* ignore empty body */
        }

        try {
          const { sessionToken, session } = await createWebchatSession(
            publicId,
            body?.visitorId,
            origin,
            body?.prechat,
          );
          return Response.json(
            {
              sessionToken,
              sessionId: session.id,
              visitorId: session.visitorId,
              conversationId: session.conversationId,
              expiresAt: session.expiresAt.toISOString(),
            },
            {
              headers: {
                "Access-Control-Allow-Origin": origin || "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            },
          );
        } catch (error: any) {
          const status = error.statusCode || 500;
          return Response.json({ error: error.message || "Failed to create session" }, { status });
        }
      },

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

        return Response.json(
          {
            sessionId: session.id,
            visitorId: session.visitorId,
            conversationId: session.conversationId,
            expiresAt: session.expiresAt.toISOString(),
          },
          {
            headers: {
              "Access-Control-Allow-Origin": origin || "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },
  },
});
