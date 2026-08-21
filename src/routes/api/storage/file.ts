import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  verifyStorageUser,
} from "@/lib/tenant-storage";
import { resolveMediaContentType } from "@/lib/media-content-type";

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

          let user: any;
          try {
            user = await verifyStorageUser(request);
          } catch {
            return new Response("Unauthorized", { status: 401 });
          }

          // Safety normalization to prevent directory traversal
          let safePath: string;
          try {
            safePath = await assertTenantStoragePath(filePath, user);
          } catch (error: any) {
            return new Response("File not found or access denied", {
              status: error?.statusCode || 403,
            });
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

          const contentType = resolveMediaContentType({
            fileName: fullPath,
            bytes: fileData,
          });

          const range = request.headers.get("range");
          const commonHeaders = {
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          };

          if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
            if (!match) {
              return new Response(null, {
                status: 416,
                headers: {
                  ...commonHeaders,
                  "Content-Range": `bytes */${fileData.length}`,
                },
              });
            }

            const requestedStart = match[1] ? Number(match[1]) : undefined;
            const requestedEnd = match[2] ? Number(match[2]) : undefined;
            const start = requestedStart ?? Math.max(fileData.length - (requestedEnd ?? 0), 0);
            const end = requestedStart === undefined
              ? fileData.length - 1
              : Math.min(requestedEnd ?? fileData.length - 1, fileData.length - 1);

            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileData.length) {
              return new Response(null, {
                status: 416,
                headers: {
                  ...commonHeaders,
                  "Content-Range": `bytes */${fileData.length}`,
                },
              });
            }

            const chunk = fileData.subarray(start, end + 1);
            return new Response(chunk, {
              status: 206,
              headers: {
                ...commonHeaders,
                "Content-Length": String(chunk.length),
                "Content-Range": `bytes ${start}-${end}/${fileData.length}`,
              },
            });
          }

          return new Response(fileData, {
            status: 200,
            headers: {
              ...commonHeaders,
              "Content-Length": String(fileData.length),
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
