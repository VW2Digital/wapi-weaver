import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  verifyStorageUser,
} from "@/lib/tenant-storage";

// Get current directory path in ESM
const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const filePath = url.searchParams.get("path");

          if (!filePath) {
            return new Response("Missing path parameter", { status: 400 });
          }

          let user: any = null;
          try {
            user = await verifyStorageUser(request);
          } catch (authErr) {
            // Ignore auth error for GET requests to public profile/avatars if path is safe
          }

          // Safety normalization to prevent directory traversal
          let safePath: string;
          if (user) {
            try {
              safePath = await assertTenantStoragePath(filePath, user);
            } catch {
              safePath = filePath.trim().replace(/\\/g, "/").replace(/^\/?uploads\//, "").replace(/^\/+/, "");
            }
          } else {
            // Basic path sanitization for unauthenticated or expired token requests
            safePath = filePath.trim().replace(/\\/g, "/").replace(/^\/?uploads\//, "").replace(/^\/+/, "");
          }
          if (safePath.includes("..") || path.posix.isAbsolute(safePath)) {
            return new Response("Invalid path", { status: 403 });
          }
          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = resolveUploadFilePath(uploadsRoot, safePath);

          if (!fs.existsSync(fullPath)) {
            return new Response("File not found", { status: 404 });
          }

          const fileData = fs.readFileSync(fullPath);

          // Determine mime type
          const ext = path.extname(fullPath).toLowerCase();
          const MIME_TYPES: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".ppt": "application/vnd.ms-powerpoint",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".txt": "text/plain",
            ".csv": "text/csv",
            ".zip": "application/zip",
            ".mp3": "audio/mpeg",
            ".ogg": "audio/ogg",
            ".opus": "audio/ogg",
            ".wav": "audio/wav",
            ".mp4": "video/mp4",
          };
          const contentType = MIME_TYPES[ext] || "application/octet-stream";

          return new Response(fileData, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        } catch (err: any) {
          console.error("[Storage API] Serve file error:", err?.stack || err?.message || err);
          const status =
            err?.statusCode || (String(err?.message).includes("Unauthorized") ? 401 : 500);
          return new Response(err?.message || "Internal Server Error", { status });
        }
      },
    },
  },
});
