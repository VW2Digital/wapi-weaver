import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/test-banners-phase-c")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    },
  },
});
