import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";

// Get current directory path in ESM
const __dirname = path.resolve();

/**
 * NOTA DE SEGURANÇA: Esta rota serve SEM AUTENTICAÇÃO qualquer arquivo dentro do diretório `public/uploads/global/`.
 * Atualmente usada exclusivamente para assets públicos de leitura global, como banners promocionais.
 * ATENÇÃO: Se no futuro novos tipos de arquivos forem armazenados em `public/uploads/global/` (ex: documentos privados),
 * eles ficarão públicos se acessados por esta rota. Garanta que apenas arquivos estritamente públicos fiquem na pasta `global/`.
 */
export const Route = createFileRoute("/api/storage/global-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const filePath = url.searchParams.get("path");

          if (!filePath) {
            return new Response("Missing path parameter", { status: 400 });
          }

          // Basic path sanitization
          const safePath = filePath.trim().replace(/\\/g, "/").replace(/^\/?uploads\//, "").replace(/^\/+/, "");

          if (safePath.includes("..") || path.posix.isAbsolute(safePath)) {
            return new Response("Invalid path", { status: 403 });
          }

          // Ensure path stays strictly inside public/uploads/global/
          if (!safePath.startsWith("global/")) {
            return new Response("Acesso negado: apenas arquivos globais podem ser servidos por esta rota", { status: 403 });
          }

          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = path.resolve(uploadsRoot, safePath);

          if (!fullPath.startsWith(path.join(uploadsRoot, "global") + path.sep)) {
            return new Response("Invalid path", { status: 403 });
          }

          if (!fs.existsSync(fullPath)) {
            return new Response("File not found", { status: 404 });
          }

          const fileData = fs.readFileSync(fullPath);

          // Determine mime type
          const ext = path.extname(fullPath).toLowerCase();
          let contentType = "application/octet-stream";
          if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
          else if (ext === ".png") contentType = "image/png";
          else if (ext === ".webp") contentType = "image/webp";
          else if (ext === ".gif") contentType = "image/gif";
          else if (ext === ".svg") contentType = "image/svg+xml";

          return new Response(fileData, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err: any) {
          console.error("[Global Storage API] Serve file error:", err?.stack || err?.message || err);
          return new Response(err?.message || "Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
