import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { classifyGalleryKind, type GalleryFile } from "@/lib/gallery-media";
import { resolveUploadFilePath, verifyStorageUser } from "@/lib/tenant-storage";

const __dirname = path.resolve();
const ALLOWED = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".3gp",
  ".mp3",
  ".ogg",
  ".wav",
  ".m4a",
  ".aac",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
]);
const MAX_FILES = 500;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function walk(dir: string, root: string, acc: GalleryFile[]) {
  if (!fs.existsSync(dir) || acc.length >= MAX_FILES) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (acc.length >= MAX_FILES) return;
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, acc);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED.has(ext)) continue;
    const stat = fs.statSync(full);
    const rel = path.relative(root, full).replace(/\\/g, "/");
    acc.push({
      path: rel,
      name: entry.name,
      size: stat.size,
      mtime: stat.mtimeMs,
      kind: classifyGalleryKind(entry.name),
    });
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
          const files: GalleryFile[] = [];
          if (fs.existsSync(tenantRoot)) walk(tenantRoot, uploadsRoot, files);
          files.sort((a, b) => b.mtime - a.mtime);
          return json({ files });
        } catch (err: any) {
          const status = /unauthorized/i.test(String(err?.message)) ? 401 : 400;
          return json({ error: err?.message || "Falha ao listar arquivos." }, status);
        }
      },
    },
  },
});
