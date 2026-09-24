import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { resolveUploadFilePath } from "@/lib/tenant-storage";
import { resolveMediaContentType } from "@/lib/media-content-type";
import { verifyGalleryShare } from "@/lib/gallery-share.server";

const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

async function serveSharedMedia(request: Request, includeBody: boolean) {
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
    const fileData = fs.readFileSync(fullPath);
    const contentType = resolveMediaContentType({
      fileName: fullPath,
      bytes: fileData,
    });
    const download = url.searchParams.get("download") === "1";
    const fileName = path.basename(fullPath);
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(fileData.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
      "Referrer-Policy": "no-referrer",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${fileName.replace(/"/g, "")}"`;
    }
    if (!includeBody) {
      return new Response(null, { status: 200, headers });
    }
    return new Response(fileData, { status: 200, headers });
  } catch (error: any) {
    return new Response(error?.message || "Unauthorized", {
      status: error?.statusCode || 401,
    });
  }
}

export const Route = createFileRoute("/api/public/gallery-media")({
  server: {
    handlers: {
      GET: async ({ request }) => serveSharedMedia(request, true),
      HEAD: async ({ request }) => serveSharedMedia(request, false),
    },
  },
});
