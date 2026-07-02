import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/licenses/health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "ok",
            role: process.env.LICENSE_ROLE || "panel",
            version: "1.0.0"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
  }
});
