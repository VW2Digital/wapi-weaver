import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";
import {
  createWhatsAppGroup,
  listWhatsAppGroups,
  getWhatsAppGroupDetails,
  sendGroupMessage,
  archiveWhatsAppGroup,
} from "@/lib/groups.functions";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function getAuthUserId(request: Request): string {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (!token) throw new Error("Unauthorized");
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (!decoded?.sub) throw new Error("Unauthorized");
  return decoded.sub;
}

export const Route = createFileRoute("/api/whatsapp/groups")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean); // ["api", "whatsapp", "groups", ...]

          if (process.env.WHATSAPP_GROUPS_ENABLED !== "true") {
            return Response.json({
              success: false,
              error: { code: "WHATSAPP_GROUPS_DISABLED", message: "Módulo de grupos desativado." }
            }, { status: 403 });
          }

          // GET /api/whatsapp/groups/:id
          if (pathParts.length > 3) {
            const groupId = pathParts[3];
            const ctx = { userId };
            const result = await getWhatsAppGroupDetails({ data: { id: groupId }, context: ctx });
            return Response.json(result);
          }

          // GET /api/whatsapp/groups
          const status = url.searchParams.get("status") || undefined;
          const search = url.searchParams.get("search") || undefined;
          const ctx = { userId };
          const result = await listWhatsAppGroups({ data: { status, search }, context: ctx });
          return Response.json(result);
        } catch (e: any) {
          return Response.json({ success: false, error: { code: "UNAUTHORIZED", message: e.message } }, { status: 401 });
        }
      },
      POST: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean); // ["api", "whatsapp", "groups", ...]

          if (process.env.WHATSAPP_GROUPS_ENABLED !== "true") {
            return Response.json({
              success: false,
              error: { code: "WHATSAPP_GROUPS_DISABLED", message: "Módulo de grupos desativado." }
            }, { status: 403 });
          }

          const body = await request.json().catch(() => ({}));
          const ctx = { userId };

          // POST /api/whatsapp/groups/:id/messages
          if (pathParts.length > 4 && pathParts[4] === "messages") {
            const groupId = pathParts[3];
            const result = await sendGroupMessage({
              data: { groupId, body: body.body || body.text || "" },
              context: ctx,
            });
            return Response.json(result);
          }

          // POST /api/whatsapp/groups/:id/archive
          if (pathParts.length > 4 && pathParts[4] === "archive") {
            const groupId = pathParts[3];
            const result = await archiveWhatsAppGroup({
              data: { id: groupId },
              context: ctx,
            });
            return Response.json(result);
          }

          // POST /api/whatsapp/groups
          const result = await createWhatsAppGroup({
            data: { name: body.name || "", description: body.description },
            context: ctx,
          });
          return Response.json(result);
        } catch (e: any) {
          return Response.json({ success: false, error: { code: "BAD_REQUEST", message: e.message } }, { status: 400 });
        }
      },
    },
  },
});
