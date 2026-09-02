import { createFileRoute } from "@tanstack/react-router";
import { getWebchatSessionByToken } from "@/lib/webchat/session.service";
import {
  applyWebchatStatusAcks,
  parseStatusUpdates,
} from "@/lib/webchat/message-status.service";
import { checkStatusAckRateLimit } from "@/lib/webchat/rate-limit.service";

/**
 * WebChat delivered/read acknowledgements.
 *
 * The conversation is always derived from the authenticated session, never from
 * the request body, so a browser cannot ACK messages of another conversation,
 * widget or tenant.
 */
export const Route = createFileRoute("/api/public/webchat/$publicId/status")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin");
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "").trim();

        const corsHeaders = {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (!publicId || !token) {
          return Response.json(
            { error: "publicId and session token are required" },
            { status: 400, headers: corsHeaders },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
        }

        const session = await getWebchatSessionByToken(publicId, token, origin);
        if (!session) {
          return Response.json(
            { error: "Invalid or expired session" },
            { status: 401, headers: corsHeaders },
          );
        }

        const allowed = await checkStatusAckRateLimit(publicId, session.id);
        if (!allowed) {
          return Response.json(
            { error: "Rate limit exceeded" },
            { status: 429, headers: corsHeaders },
          );
        }

        try {
          const updates = parseStatusUpdates(body);
          const result = await applyWebchatStatusAcks(session, updates);
          return Response.json(result, { headers: corsHeaders });
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 400) {
            return Response.json(
              { error: (error as Error).message },
              { status: 400, headers: corsHeaders },
            );
          }
          console.error("[WebChat Status] Failed to apply status ACKs", {
            tenantId: session.tenantId,
            sessionId: session.id,
            message: (error as Error)?.message,
          });
          return Response.json(
            { error: "Failed to apply status updates" },
            { status: 500, headers: corsHeaders },
          );
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
