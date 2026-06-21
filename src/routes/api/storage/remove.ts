import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/remove")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { paths } = await request.json();
          if (!Array.isArray(paths)) {
            return new Response(JSON.stringify({ error: "Paths must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          for (const filePath of paths) {
            const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
            const fullPath = path.join(__dirname, "public", "uploads", safePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Storage API] Remove error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
