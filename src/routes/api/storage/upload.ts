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

          // Safety normalization to prevent directory traversal
          const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
          const fullPath = path.join(__dirname, "public", "uploads", safePath);
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
