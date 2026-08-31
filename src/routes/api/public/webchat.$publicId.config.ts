import { createFileRoute } from "@tanstack/react-router";
import { getWidgetByPublicId } from "@/lib/webchat/widget.repository";

export const Route = createFileRoute("/api/public/webchat/$publicId/config")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin") ?? "";
        if (!publicId) {
          return new Response(JSON.stringify({ error: "Public ID missing" }), { status: 400 });
        }

        const widget = await getWidgetByPublicId(publicId);
        if (!widget || !widget.enabled) {
          return new Response(JSON.stringify({ error: "Widget not found" }), { status: 404 });
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        return new Response(
          JSON.stringify({
            publicId: widget.publicId,
            title: widget.title,
            welcomeMessage: widget.welcomeMessage,
            placeholder: widget.placeholder,
            accentColor: widget.accentColor,
            position: widget.position,
          }),
          { headers },
        );
      },

      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("origin") ?? "";
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
