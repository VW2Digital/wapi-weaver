import { lookup } from "node:dns/promises";
import fs from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { looksLikeHttpUrl, looksLikeMetaUploadHandle, parseBlivStorageFilePath } from "@/lib/whatsapp-template-payload";
import { logTemplateMetaFailure, toFriendlyTemplateError } from "@/lib/meta-errors";
import type { AuthenticatedUser } from "@/lib/subscription-helpers";
import { assertTenantStoragePath, resolveUploadFilePath } from "@/lib/tenant-storage";

export { parseBlivStorageFilePath } from "@/lib/whatsapp-template-payload";

export const TEMPLATE_MEDIA_LIMITS = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/jpg", "image/png"], ext: ["jpg", "jpeg", "png"] },
  VIDEO: { maxBytes: 16 * 1024 * 1024, mime: ["video/mp4"], ext: ["mp4"] },
  DOCUMENT: { maxBytes: 100 * 1024 * 1024, mime: ["application/pdf"], ext: ["pdf"] },
} as const;

export type TemplateMediaFormat = keyof typeof TEMPLATE_MEDIA_LIMITS;

export class TemplateMediaError extends Error {
  code: string;
  constructor(message: string, code = "media_invalid") {
    super(message);
    this.name = "TemplateMediaError";
    this.code = code;
  }
}

export function normalizeGraphApiVersion(value: unknown): string {
  const raw = String(value || process.env.META_GRAPH_VERSION || "v26.0").trim();
  const withV = raw.startsWith("v") ? raw : `v${raw}`;
  if (/^v2[4-6]\.\d+$/.test(withV)) return withV;
  return "v26.0";
}

export function detectTemplateMediaKind(bytes: Uint8Array): {
  mimeType: string;
  ext: string;
  format: TemplateMediaFormat | null;
} | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg", format: "IMAGE" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: "png", format: "IMAGE" };
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: "application/pdf", ext: "pdf", format: "DOCUMENT" };
  }
  if (bytes.length >= 12) {
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === "ftyp") {
      return { mimeType: "video/mp4", ext: "mp4", format: "VIDEO" };
    }
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

export async function loadTemplateMediaFromLibrary(params: {
  format: TemplateMediaFormat;
  libraryPath: string;
  user: AuthenticatedUser;
}): Promise<{ bytes: Uint8Array; mimeType: string; filename: string }> {
  const safePath = await assertTenantStoragePath(params.libraryPath, params.user);
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const fullPath = resolveUploadFilePath(uploadsRoot, safePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new TemplateMediaError("Arquivo da biblioteca não encontrado.", "library_missing");
  }
  const bytes = new Uint8Array(fs.readFileSync(fullPath));
  return {
    bytes,
    ...validateTemplateMediaBytes({
      format: params.format,
      bytes,
      filename: path.basename(fullPath),
    }),
  };
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TemplateMediaError("URL de mídia inválida.", "url_invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TemplateMediaError("Use apenas URLs http(s) públicas.", "url_scheme");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0"
  ) {
    throw new TemplateMediaError("URL interna bloqueada (SSRF).", "ssrf");
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new TemplateMediaError("IP privado bloqueado (SSRF).", "ssrf");
  }
  try {
    const records = await lookup(host, { all: true });
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new TemplateMediaError("O host resolve para um endereço privado (SSRF).", "ssrf");
      }
    }
  } catch (err) {
    if (err instanceof TemplateMediaError) throw err;
    throw new TemplateMediaError("Não foi possível resolver o host da URL.", "url_dns");
  }
  return url;
}

export function validateTemplateMediaBytes(params: {
  format: TemplateMediaFormat;
  bytes: Uint8Array;
  claimedMime?: string;
  filename?: string;
}): { mimeType: string; filename: string } {
  const spec = TEMPLATE_MEDIA_LIMITS[params.format];
  if (!params.bytes.byteLength) {
    throw new TemplateMediaError("Arquivo de exemplo vazio.", "empty");
  }
  if (params.bytes.byteLength > spec.maxBytes) {
    throw new TemplateMediaError(
      `Arquivo excede o limite da Meta para ${params.format} (${Math.round(spec.maxBytes / (1024 * 1024))} MB).`,
      "too_large",
    );
  }
  const detected = detectTemplateMediaKind(params.bytes);
  if (!detected || detected.format !== params.format) {
    throw new TemplateMediaError(
      `O conteúdo real do arquivo não é um ${params.format} válido (extensão ou MIME falso).`,
      "magic_mismatch",
    );
  }
  const claimed = String(params.claimedMime || "").split(";")[0].trim().toLowerCase();
  if (claimed && claimed !== "application/octet-stream" && !(spec.mime as readonly string[]).includes(claimed)) {
    throw new TemplateMediaError(
      `MIME declarado inválido para ${params.format}: ${claimed}.`,
      "mime_claimed",
    );
  }
  if (claimed && claimed !== "application/octet-stream" && claimed !== detected.mimeType && claimed !== "image/jpg") {
    if (!(detected.mimeType === "image/jpeg" && claimed === "image/jpg")) {
      throw new TemplateMediaError(
        "O MIME declarado não corresponde ao conteúdo do arquivo.",
        "magic_mismatch",
      );
    }
  }
  const base = String(params.filename || `template-header.${detected.ext}`).replace(/[^\w.\-]+/g, "_");
  const filename = base.toLowerCase().endsWith(`.${detected.ext}`) ? base : `${base}.${detected.ext}`;
  return { mimeType: detected.mimeType, filename };
}

export async function fetchExternalTemplateMedia(params: {
  format: TemplateMediaFormat;
  sourceUrl: string;
}): Promise<{ bytes: Uint8Array; mimeType: string; filename: string }> {
  if (parseBlivStorageFilePath(params.sourceUrl)) {
    throw new TemplateMediaError(
      "Mídia da biblioteca deve ser lida no disco, não baixada por HTTP autenticado.",
      "storage_http",
    );
  }
  const spec = TEMPLATE_MEDIA_LIMITS[params.format];
  let current = String(params.sourceUrl || "").trim();
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    const safeUrl = await assertPublicHttpUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      res = await fetch(safeUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: spec.mime.join(",") },
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new TemplateMediaError("Tempo esgotado ao baixar a URL externa.", "timeout");
      }
      throw new TemplateMediaError("URL externa inacessível.", "fetch_failed");
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new TemplateMediaError("Redirecionamento sem Location.", "redirect");
      current = new URL(loc, safeUrl).toString();
      continue;
    }
    break;
  }
  if (!res) throw new TemplateMediaError("URL externa inacessível.", "fetch_failed");
  if (!res.ok) {
    throw new TemplateMediaError(`Não foi possível baixar a mídia (HTTP ${res.status}).`, "fetch_http");
  }
  const declaredLength = Number(res.headers.get("content-length") || 0);
  if (declaredLength > spec.maxBytes) {
    throw new TemplateMediaError("Arquivo acima do limite da Meta.", "too_large");
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const claimed = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return {
    bytes: buf,
    ...validateTemplateMediaBytes({
      format: params.format,
      bytes: buf,
      claimedMime: claimed,
      filename: `template-header`,
    }),
  };
}

export async function uploadTemplateMediaHandle(params: {
  appId: string;
  accessToken: string;
  apiVersion?: string;
  format: TemplateMediaFormat;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<string> {
  if (!params.appId) {
    throw new TemplateMediaError("App ID da conexão Meta é obrigatório para o upload resumable.", "app_id");
  }
  const apiVersion = normalizeGraphApiVersion(params.apiVersion);
  const mimeType = params.mimeType === "image/jpg" ? "image/jpeg" : params.mimeType;
  const startOnce = async () => {
    const startUrl = `https://graph.facebook.com/${apiVersion}/${params.appId}/uploads`;
    const start = await fetch(startUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: params.filename,
        file_length: params.bytes.byteLength,
        file_type: mimeType,
      }),
    });
    const startBody: any = await start.json().catch(() => ({}));
    if (!start.ok || startBody.error) {
      logTemplateMetaFailure({
        endpoint: `POST /${apiVersion}/{APP_ID}/uploads`,
        apiVersion,
        httpStatus: start.status,
        code: startBody?.error?.code,
        error_subcode: startBody?.error?.error_subcode,
        message: startBody?.error?.message,
        details: startBody?.error?.error_data?.details ?? startBody?.error?.error_data,
        fbtrace_id: startBody?.error?.fbtrace_id,
        payload: { file_name: params.filename, file_type: mimeType, file_length: params.bytes.byteLength },
      });
      const friendly = toFriendlyTemplateError(startBody, "Falha ao iniciar o upload resumable na Meta.");
      throw new TemplateMediaError(
        `${friendly.title}: ${friendly.message}${friendly.hint ? ` — ${friendly.hint}` : ""}`,
        "upload_session",
      );
    }
    const sessionId = String(startBody?.id || "");
    if (!sessionId.startsWith("upload:")) {
      throw new TemplateMediaError("A Meta não devolveu um upload session id válido.", "upload_session");
    }
    const upload = await fetch(`https://graph.facebook.com/${apiVersion}/${sessionId}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${params.accessToken}`,
        file_offset: "0",
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(params.bytes),
    });
    const uploaded: any = await upload.json().catch(() => ({}));
    if (!upload.ok || uploaded.error) {
      logTemplateMetaFailure({
        endpoint: `POST /${apiVersion}/{upload-session}`,
        apiVersion,
        httpStatus: upload.status,
        code: uploaded?.error?.code,
        error_subcode: uploaded?.error?.error_subcode,
        message: uploaded?.error?.message,
        details: uploaded?.error?.error_data?.details ?? uploaded?.error?.error_data,
        fbtrace_id: uploaded?.error?.fbtrace_id,
        payload: { file_name: params.filename, file_type: mimeType },
      });
      const msg = String(uploaded?.error?.message || "");
      if (/expired|session/i.test(msg)) {
        throw new TemplateMediaError("Sessão de upload expirada na Meta. Tente novamente.", "session_expired");
      }
      if (/network|fetch|econnreset/i.test(msg)) {
        throw new TemplateMediaError("Falha de rede durante o envio do arquivo à Meta.", "network");
      }
      const friendly = toFriendlyTemplateError(uploaded, "Falha ao enviar o binário do cabeçalho para a Meta.");
      throw new TemplateMediaError(
        `${friendly.title}: ${friendly.message}${friendly.hint ? ` — ${friendly.hint}` : ""}`,
        "upload_binary",
      );
    }
    const handle = String(uploaded?.h || "").trim();
    if (!handle || looksLikeHttpUrl(handle) || !looksLikeMetaUploadHandle(handle)) {
      throw new TemplateMediaError("A Meta não devolveu um handle de upload válido.", "handle_missing");
    }
    return handle;
  };

  try {
    return await startOnce();
  } catch (err) {
    if (err instanceof TemplateMediaError && err.code === "session_expired") {
      return startOnce();
    }
    throw err;
  }
}

export async function resolveHeaderHandle(params: {
  format: TemplateMediaFormat;
  value: string;
  appId: string;
  accessToken: string;
  apiVersion?: string;
  expectedAppId?: string;
  libraryPath?: string;
  user?: AuthenticatedUser;
}): Promise<string> {
  const value = String(params.value || "").trim();
  const fromStorageUrl = parseBlivStorageFilePath(value);
  const libraryPath =
    fromStorageUrl ||
    String(params.libraryPath || "").trim() ||
    (!looksLikeHttpUrl(value) && !looksLikeMetaUploadHandle(value) && value.includes("/") ? value : "");

  const uploadFile = async (file: { bytes: Uint8Array; mimeType: string; filename: string }) =>
    uploadTemplateMediaHandle({
      appId: params.appId,
      accessToken: params.accessToken,
      apiVersion: params.apiVersion,
      format: params.format,
      filename: file.filename,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });

  // Always mint a fresh handle at template submit. Client-stored 4: handles expire.
  if (libraryPath) {
    if (!params.user) {
      throw new TemplateMediaError(
        "Não foi possível autenticar a leitura da mídia na biblioteca.",
        "library_auth",
      );
    }
    return uploadFile(
      await loadTemplateMediaFromLibrary({
        format: params.format,
        libraryPath,
        user: params.user,
      }),
    );
  }

  if (looksLikeHttpUrl(value) && !fromStorageUrl) {
    return uploadFile(await fetchExternalTemplateMedia({ format: params.format, sourceUrl: value }));
  }

  throw new TemplateMediaError(
    "Envie de novo o arquivo do cabeçalho. O identificador da Meta expira e não pode ser reutilizado.",
    "handle_stale",
  );
}

/** @deprecated use fetchExternalTemplateMedia */
export async function fetchAndValidateTemplateMedia(params: {
  format: TemplateMediaFormat;
  sourceUrl: string;
}) {
  return fetchExternalTemplateMedia(params);
}
