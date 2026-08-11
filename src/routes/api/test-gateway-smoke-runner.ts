import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test-gateway-smoke-runner")({
  server: {
    handlers: {
      GET: async () => new Response("Not Found", { status: 404 }),
    },
  },
});
