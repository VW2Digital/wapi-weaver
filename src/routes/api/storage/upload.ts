import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import { resolveUploadFilePath, tenantUploadPath, verifyStorageUser } from "@/lib/tenant-storage";

// Get current directory path in ESM
const __dirname = path.resolve();

/**
 * Lê o corpo do request como Buffer via ReadableStream, evitando o erro
 * "Body has already been read" causado pelo Vinxi/h3 que consome o body
 * antes de chegar ao handler quando se usa request.json() ou request.formData().
 */
async function readRawBody(request: Request): Promise<Buffer> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

export const Route = createFileRoute("/api/storage/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          let filePath = "";
          let buffer: Buffer | null = null;
          const contentType = request.headers.get("content-type") || "";

          // Lê o body raw uma única vez para evitar "Body has already been read"
          const rawBody = await readRawBody(request);

          if (contentType.includes("multipart/form-data")) {
            // Reconstrói um Request temporário com o body lido para usar formData()
            const tempRequest = new Request(request.url, {
              method: "POST",
              headers: request.headers,
              body: rawBody,
            });
            const form = await tempRequest.formData();
            const pathField = form.get("path");
            const fileField = form.get("file");

            if (
              typeof pathField !== "string" ||
              !pathField.trim() ||
              !(fileField instanceof File)
            ) {
              return new Response(JSON.stringify({ error: "Missing path or file" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            filePath = pathField.trim();
            buffer = Buffer.from(await fileField.arrayBuffer());
          } else {
            // JSON com base64
            let body: any;
            try {
              body = JSON.parse(rawBody.toString("utf-8"));
            } catch {
              return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
            filePath = body?.path || "";
            const fileData = body?.fileData;

            if (!filePath || !fileData) {
              return new Response(JSON.stringify({ error: "Missing path or fileData" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            buffer = Buffer.from(fileData, "base64");
          }

          const ALLOWED_EXTENSIONS = new Set([
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".pdf",
            ".mp4",
            ".mp3",
            ".ogg",
            ".csv",
            ".doc",
            ".docx",
          ]);
          const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

          if (buffer.length > MAX_SIZE_BYTES) {
            return new Response(JSON.stringify({ error: "File too large (max 20MB)" }), {
              status: 413,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Safety normalization to prevent directory traversal
          const safePath = await tenantUploadPath(filePath, user);
          const ext = path.extname(safePath).toLowerCase();

          if (!ALLOWED_EXTENSIONS.has(ext) && ext !== "") {
            return new Response(JSON.stringify({ error: "File type not allowed" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = resolveUploadFilePath(uploadsRoot, safePath);

          // Ensure the resolved path is strictly inside the uploads directory
          if (!fullPath.startsWith(uploadsRoot + path.sep) && fullPath !== uploadsRoot) {
            return new Response(JSON.stringify({ error: "Invalid path" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const dir = path.dirname(fullPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, buffer);

          return new Response(JSON.stringify({ success: true, path: safePath }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Storage API] Upload error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
