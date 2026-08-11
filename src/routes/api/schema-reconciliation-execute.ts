import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/schema-reconciliation-execute")({
  server: {
    handlers: {
      POST: async () => new Response("Not Found", { status: 404 }),
    },
  },
});
