import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { resolveUploadFilePath, verifyStorageUser } from "@/lib/tenant-storage";

const __dirname = path.resolve();
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".mp4", ".pdf"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function walk(dir: string, root: string, acc: Array<{ path: string; name: string; size: number }>) {
  if (!fs.existsSync(dir) || acc.length >= 200) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (acc.length >= 200) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, acc);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED.has(ext)) continue;
    const rel = path.relative(root, full).replace(/\\/g, "/");
    acc.push({ path: rel, name: entry.name, size: fs.statSync(full).size });
  }
}

export const Route = createFileRoute("/api/storage/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const tenantRoot = resolveUploadFilePath(uploadsRoot, user.tenantId);
          const files: Array<{ path: string; name: string; size: number }> = [];
          if (fs.existsSync(tenantRoot)) walk(tenantRoot, uploadsRoot, files);
          files.sort((a, b) => a.name.localeCompare(b.name));
          return json({ files });
        } catch (err: any) {
          const status = /unauthorized/i.test(String(err?.message)) ? 401 : 400;
          return json({ error: err?.message || "Falha ao listar arquivos." }, status);
        }
      },
    },
  },
});
