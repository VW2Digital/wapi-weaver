import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { resolveUploadFilePath } from "@/lib/tenant-storage";
import { createUploadFileResponse } from "@/lib/upload-file-response.server";
import { verifyGalleryShare } from "@/lib/gallery-share.server";

const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

async function serveSharedMedia(request: Request) {
  const url = new URL(request.url);
  try {
    const verified = verifyGalleryShare({
      path: url.searchParams.get("path"),
      exp: url.searchParams.get("exp"),
      sig: url.searchParams.get("sig"),
    });
    const fullPath = resolveUploadFilePath(uploadsRoot, verified.mediaPath);
    if (!fs.existsSync(fullPath)) {
      return new Response("File not found", { status: 404 });
    }
    const download = url.searchParams.get("download") === "1";
    const fileName = path.basename(fullPath);
    const extra: Record<string, string> = {
      "Cache-Control": "private, max-age=300",
    };
    if (download) {
      extra["Content-Disposition"] = `attachment; filename="${fileName.replace(/"/g, "")}"`;
    }
    return createUploadFileResponse(fullPath, request, extra);
  } catch (error: any) {
    return new Response(error?.message || "Unauthorized", {
      status: error?.statusCode || 401,
    });
  }
}

export const Route = createFileRoute("/api/public/gallery-media")({
  server: {
    handlers: {
      GET: async ({ request }) => serveSharedMedia(request),
      HEAD: async ({ request }) => serveSharedMedia(request),
    },
  },
});
