import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  verifyStorageUser,
} from "@/lib/tenant-storage";

const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/remove")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const { paths } = await request.json();
          if (!Array.isArray(paths)) {
            return new Response(JSON.stringify({ error: "Paths must be an array" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          for (const filePath of paths) {
            const safePath = await assertTenantStoragePath(filePath, user);
            const uploadsRoot = path.resolve(__dirname, "public", "uploads");
            const fullPath = resolveUploadFilePath(uploadsRoot, safePath);
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
          const status =
            err?.statusCode || (String(err?.message).includes("Unauthorized") ? 401 : 500);
          return new Response(JSON.stringify({ error: err.message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
