import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  verifyStorageUser,
} from "@/lib/tenant-storage";
import { createUploadFileResponse } from "@/lib/upload-file-response.server";

const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/file")({
  server: {
    handlers: {
      GET: async ({ request }) => serveFile(request),
      HEAD: async ({ request }) => serveFile(request),
    },
  },
});

async function serveFile(request: Request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");

    if (!filePath) {
      return new Response("Missing path parameter", { status: 400 });
    }

    let user;
    try {
      user = await verifyStorageUser(request);
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    let safePath: string;
    try {
      safePath = await assertTenantStoragePath(filePath, user);
    } catch {
      return new Response("Forbidden", { status: 403 });
    }

    if (safePath.includes("..") || path.posix.isAbsolute(safePath)) {
      return new Response("Invalid path", { status: 403 });
    }
    const uploadsRoot = path.resolve(__dirname, "public", "uploads");
    const fullPath = resolveUploadFilePath(uploadsRoot, safePath);

    if (!fs.existsSync(fullPath)) {
      return new Response("File not found", { status: 404 });
    }

    return createUploadFileResponse(fullPath, request, {
      "Cache-Control": "private, no-store",
    });
  } catch (err: any) {
    console.error("[Storage API] Serve file error:", err?.stack || err?.message || err);
    const status =
      err?.statusCode || (String(err?.message).includes("Unauthorized") ? 401 : 500);
    return new Response(err?.message || "Internal Server Error", { status });
  }
}
