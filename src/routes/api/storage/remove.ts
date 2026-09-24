import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  verifyStorageUser,
} from "@/lib/tenant-storage";

const __dirname = path.resolve();
const MAX_DELETE = 100;

export const Route = createFileRoute("/api/storage/remove")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const body = await request.json().catch(() => ({}));
          const paths = Array.isArray(body?.paths) ? body.paths : [];
          if (!paths.length) {
            return json({ error: "Paths must be an array" }, 400);
          }
          if (paths.length > MAX_DELETE) {
            return json({ error: `Máximo de ${MAX_DELETE} arquivos por exclusão.` }, 400);
          }

          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          let deleted = 0;
          for (const filePath of paths) {
            const safePath = await assertTenantStoragePath(filePath, user);
            const fullPath = resolveUploadFilePath(uploadsRoot, safePath);
            try {
              const stat = await fs.lstat(fullPath);
              if (!stat.isFile()) continue;
              await fs.unlink(fullPath);
              deleted += 1;
            } catch (err: any) {
              if (err?.code === "ENOENT") continue;
              throw err;
            }
          }

          return json({ success: true, deleted });
        } catch (err: any) {
          console.error("[Storage API] Remove error:", err);
          const status =
            err?.statusCode || (String(err?.message).includes("Unauthorized") ? 401 : 500);
          return json({ error: err?.message || "Falha ao excluir arquivo." }, status);
        }
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
