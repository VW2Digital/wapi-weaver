import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";

// Get current directory path in ESM
const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let filePath = "";
          let buffer: Buffer | null = null;
          const contentType = request.headers.get("content-type") || "";

          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
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
            const body = await request.json();
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

          const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4", ".mp3", ".ogg", ".csv", ".doc", ".docx"]);
          const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

          if (buffer.length > MAX_SIZE_BYTES) {
            return new Response(JSON.stringify({ error: "File too large (max 20MB)" }), { status: 413, headers: { "Content-Type": "application/json" } });
          }

          // Safety normalization to prevent directory traversal
          const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
          const ext = path.extname(safePath).toLowerCase();
          
          if (!ALLOWED_EXTENSIONS.has(ext) && ext !== "") {
            return new Response(JSON.stringify({ error: "File type not allowed" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }

          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = path.resolve(uploadsRoot, safePath);
          
          // Ensure the resolved path is strictly inside the uploads directory
          if (!fullPath.startsWith(uploadsRoot + path.sep) && fullPath !== uploadsRoot) {
            return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: { "Content-Type": "application/json" } });
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
