import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveOfficialWhatsAppTemplateAccount } from "@/lib/whatsapp-template-credentials";
import {
  fetchExternalTemplateMedia,
  TemplateMediaError,
  uploadTemplateMediaHandle,
  validateTemplateMediaBytes,
  type TemplateMediaFormat,
} from "@/lib/whatsapp-template-media";
import {
  assertTenantStoragePath,
  resolveUploadFilePath,
  tenantUploadPath,
  verifyStorageUser,
} from "@/lib/tenant-storage";

const __dirname = path.resolve();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isFormat(value: string): value is TemplateMediaFormat {
  return value === "IMAGE" || value === "VIDEO" || value === "DOCUMENT";
}

export const Route = createFileRoute("/api/templates/header-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const contentType = request.headers.get("content-type") || "";
          let format = "";
          let source: "file" | "url" | "library" = "file";
          let filename = "template-header";
          let claimedMime = "";
          let sourceUrl = "";
          let libraryPath = "";
          let bytes: Uint8Array | null = null;

          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            format = String(form.get("format") || "").trim().toUpperCase();
            source = (String(form.get("source") || "file") as typeof source) || "file";
            sourceUrl = String(form.get("url") || "").trim();
            libraryPath = String(form.get("library_path") || "").trim();
            const file = form.get("file");
            if (file instanceof File) {
              filename = file.name || filename;
              claimedMime = file.type || "";
              bytes = new Uint8Array(await file.arrayBuffer());
            }
          } else {
            const body = await request.json().catch(() => ({}));
            format = String(body.format || "").trim().toUpperCase();
            source = body.source || (body.url ? "url" : body.library_path ? "library" : "file");
            sourceUrl = String(body.url || "").trim();
            libraryPath = String(body.library_path || "").trim();
            filename = String(body.filename || filename);
            claimedMime = String(body.mime_type || "");
            if (body.file_base64) {
              bytes = new Uint8Array(Buffer.from(String(body.file_base64), "base64"));
            }
          }

          if (!isFormat(format)) {
            return json({ error: "Informe o formato IMAGE, VIDEO ou DOCUMENT." }, 400);
          }

          const account = await resolveOfficialWhatsAppTemplateAccount(user.tenantId);
          if (!account?.appId || !account.accessToken) {
            return json(
              {
                error:
                  "Conexão oficial da Meta incompleta. É preciso App ID e token com permissão para gerenciar templates. Evolution API não envia mídia de template.",
              },
              400,
            );
          }

          if (source === "url") {
            const fetched = await fetchExternalTemplateMedia({ format, sourceUrl });
            bytes = fetched.bytes;
            filename = fetched.filename;
            claimedMime = fetched.mimeType;
          } else if (source === "library") {
            const safePath = await assertTenantStoragePath(libraryPath, user);
            const uploadsRoot = path.resolve(__dirname, "public", "uploads");
            const fullPath = resolveUploadFilePath(uploadsRoot, safePath);
            if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
              return json({ error: "Arquivo da biblioteca não encontrado." }, 404);
            }
            bytes = new Uint8Array(fs.readFileSync(fullPath));
            filename = path.basename(fullPath);
          }

          if (!bytes) {
            return json({ error: "Nenhum arquivo foi enviado." }, 400);
          }

          const validated = validateTemplateMediaBytes({
            format,
            bytes,
            claimedMime,
            filename,
          });

          const handle = await uploadTemplateMediaHandle({
            appId: account.appId,
            accessToken: account.accessToken,
            apiVersion: account.graphVersion,
            format,
            filename: validated.filename,
            mimeType: validated.mimeType,
            bytes,
          });

          const relative = await tenantUploadPath(
            `template-headers/${randomUUID()}.${validated.filename.split(".").pop()}`,
            user,
          );
          const uploadsRoot = path.resolve(__dirname, "public", "uploads");
          const fullPath = resolveUploadFilePath(uploadsRoot, relative);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, Buffer.from(bytes));

          return json({
            success: true,
            handle,
            format,
            mime_type: validated.mimeType,
            filename: validated.filename,
            local_path: relative,
            preview_url: `/api/storage/file?path=${encodeURIComponent(relative)}`,
            app_id: account.appId,
            waba_id_len: account.wabaId.length,
            graph_version: account.graphVersion,
          });
        } catch (err: any) {
          const status =
            err instanceof TemplateMediaError && err.code === "ssrf"
              ? 400
              : err?.statusCode === 403
                ? 403
                : err?.message === "Unauthorized" || /unauthorized/i.test(String(err?.message))
                  ? 401
                  : 400;
          console.error("[templates] header_media_upload_failed", {
            code: err instanceof TemplateMediaError ? err.code : undefined,
            message: err?.message,
          });
          return json({ error: err?.message || "Falha no upload do cabeçalho." }, status);
        }
      },
    },
  },
});
