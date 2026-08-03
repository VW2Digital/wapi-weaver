import { createFileRoute } from "@tanstack/react-router";
import {
  createWhatsAppGroup,
  listWhatsAppGroups,
  getWhatsAppGroupDetails,
  sendGroupMessage,
  archiveWhatsAppGroup,
} from "@/lib/groups.functions";

export const Route = createFileRoute("/api/whatsapp/groups")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean); // ["api", "whatsapp", "groups", ...]

          if (process.env.WHATSAPP_GROUPS_ENABLED === "false") {
            return Response.json(
              {
                success: false,
                error: {
                  code: "WHATSAPP_GROUPS_DISABLED",
                  message: "Módulo de grupos desativado.",
                },
              },
              { status: 403 },
            );
          }

          // GET /api/whatsapp/groups/:id
          if (pathParts.length > 3) {
            const groupId = pathParts[3];
            const result = await getWhatsAppGroupDetails({
              data: { id: groupId },
              headers: request.headers,
            });
            return Response.json(result);
          }

          // GET /api/whatsapp/groups
          const status = url.searchParams.get("status") || undefined;
          const search = url.searchParams.get("search") || undefined;
          const result = await listWhatsAppGroups({
            data: { status, search },
            headers: request.headers,
          });
          return Response.json(result);
        } catch (e: any) {
          return Response.json(
            { success: false, error: { code: "UNAUTHORIZED", message: e.message } },
            { status: 401 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/").filter(Boolean); // ["api", "whatsapp", "groups", ...]

          if (process.env.WHATSAPP_GROUPS_ENABLED === "false") {
            return Response.json(
              {
                success: false,
                error: {
                  code: "WHATSAPP_GROUPS_DISABLED",
                  message: "Módulo de grupos desativado.",
                },
              },
              { status: 403 },
            );
          }

          const body = await request.json().catch(() => ({}));

          // POST /api/whatsapp/groups/:id/messages
          if (pathParts.length > 4 && pathParts[4] === "messages") {
            const groupId = pathParts[3];
            const result = await sendGroupMessage({
              data: { groupId, body: body.body || body.text || "" },
              headers: request.headers,
            });
            return Response.json(result);
          }

          // POST /api/whatsapp/groups/:id/archive
          if (pathParts.length > 4 && pathParts[4] === "archive") {
            const groupId = pathParts[3];
            const result = await archiveWhatsAppGroup({
              data: { id: groupId },
              headers: request.headers,
            });
            return Response.json(result);
          }

          // POST /api/whatsapp/groups
          const result = await createWhatsAppGroup({
            data: { name: body.name || "", description: body.description },
            headers: request.headers,
          });
          return Response.json(result);
        } catch (e: any) {
          return Response.json(
            { success: false, error: { code: "BAD_REQUEST", message: e.message } },
            { status: 400 },
          );
        }
      },
    },
  },
});
