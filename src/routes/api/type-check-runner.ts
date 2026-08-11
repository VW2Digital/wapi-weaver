import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/type-check-runner")({
  server: {
    handlers: {
      GET: async () => new Response("Not Found", { status: 404 }),
    },
  },
});
