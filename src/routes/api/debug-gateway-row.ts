import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug-gateway-row")({
  server: {
    handlers: {
      GET: async () => new Response("Not Found", { status: 404 }),
    },
  },
});
