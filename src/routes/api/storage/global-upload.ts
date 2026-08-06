import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { verifyStorageUser } from "@/lib/tenant-storage";
import db from "@/lib/db";
import { hasMasterRole } from "@/lib/roles";

const __dirname = path.resolve();

export const Route = createFileRoute("/api/storage/global-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);

          // Check if user has admin_master role
          const roleRows = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
            user.userId,
          ])) as Array<{ role: string }>;

          if (!hasMasterRole(roleRows.map(({ role }) => role))) {
            return new Response(
              JSON.stringify({ error: "Acesso negado: apenas admin_master pode enviar arquivos globais." }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          let originalFilename = "";
          let buffer: Buffer | null = null;
          const contentType = request.headers.get("content-type") || "";

          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            const fileField = form.get("file");

            if (!(fileField instanceof File)) {
              return new Response(JSON.stringify({ error: "Campo 'file' é obrigatório" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            originalFilename = fileField.name;
            buffer = Buffer.from(await fileField.arrayBuffer());
          } else {
            const body = await request.json();
            const fileData = body?.fileData;
            originalFilename = body?.filename || "upload.jpg";

            if (!fileData) {
              return new Response(JSON.stringify({ error: "Campo 'fileData' é obrigatório" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            buffer = Buffer.from(fileData, "base64");
          }

          const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
          if (buffer.length > MAX_SIZE_BYTES) {
            return new Response(JSON.stringify({ error: "Arquivo muito grande (máx 20MB)" }), {
              status: 413,
              headers: { "Content-Type": "application/json" },
            });
          }

          const ext = path.extname(originalFilename).toLowerCase() || ".png";
          const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

          if (!ALLOWED_EXTENSIONS.has(ext)) {
            return new Response(JSON.stringify({ error: "Formato de imagem não permitido" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const filename = `${crypto.randomUUID()}${ext}`;
          const safePath = `global/banners/${filename}`;

          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = path.resolve(uploadsRoot, safePath);

          // Prevent directory traversal
          if (!fullPath.startsWith(path.join(uploadsRoot, "global") + path.sep)) {
            return new Response(JSON.stringify({ error: "Caminho inválido" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, buffer);

          const publicUrl = `/api/storage/global-file?path=${encodeURIComponent(safePath)}`;

          return new Response(
            JSON.stringify({
              success: true,
              path: safePath,
              url: publicUrl,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          console.error("[Global Storage API] Erro no upload:", err);
          return new Response(JSON.stringify({ error: err.message || "Erro no upload" }), {
            status: err.statusCode || 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
