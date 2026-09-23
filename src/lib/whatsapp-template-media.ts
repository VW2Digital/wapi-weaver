import { looksLikeHttpUrl, looksLikeMetaUploadHandle } from "@/lib/whatsapp-template-payload";

const MEDIA_LIMITS = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/jpg", "image/png"], ext: ["jpg", "jpeg", "png"] },
  VIDEO: { maxBytes: 16 * 1024 * 1024, mime: ["video/mp4"], ext: ["mp4"] },
  DOCUMENT: { maxBytes: 100 * 1024 * 1024, mime: ["application/pdf"], ext: ["pdf"] },
} as const;

export type TemplateMediaFormat = keyof typeof MEDIA_LIMITS;

function normalizeApiVersion(value: unknown): string {
  const raw = String(value || process.env.META_GRAPH_VERSION || "v26.0").trim();
  const withV = raw.startsWith("v") ? raw : `v${raw}`;
  if (/^v2[4-6]\.\d+$/.test(withV)) return withV;
  return "v26.0";
}

function guessExt(url: string, mime: string, format: TemplateMediaFormat): string {
  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUrl && (MEDIA_LIMITS[format].ext as readonly string[]).includes(fromUrl)) return fromUrl;
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("pdf")) return "pdf";
  return MEDIA_LIMITS[format].ext[0];
}

export async function fetchAndValidateTemplateMedia(params: {
  format: TemplateMediaFormat;
  sourceUrl: string;
}): Promise<{ bytes: Uint8Array; mimeType: string; filename: string }> {
  const spec = MEDIA_LIMITS[params.format];
  const res = await fetch(params.sourceUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Não foi possível baixar a mídia de exemplo (HTTP ${res.status}).`);
  }
  const mimeType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (
    mimeType &&
    !(spec.mime as readonly string[]).includes(mimeType) &&
    mimeType !== "application/octet-stream"
  ) {
    throw new Error(
      `MIME inválido para cabeçalho ${params.format}: ${mimeType}. Use ${spec.mime.join(", ")}.`,
    );
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("Arquivo de exemplo vazio.");
  if (buf.byteLength > spec.maxBytes) {
    throw new Error(
      `Arquivo excede o limite da Meta para ${params.format} (${Math.round(spec.maxBytes / (1024 * 1024))} MB).`,
    );
  }
  const resolvedMime = mimeType && mimeType !== "application/octet-stream" ? mimeType : spec.mime[0];
  const filename = `template-header.${guessExt(params.sourceUrl, resolvedMime, params.format)}`;
  return { bytes: buf, mimeType: resolvedMime, filename };
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
  const apiVersion = normalizeApiVersion(params.apiVersion);
  const startUrl = new URL(`https://graph.facebook.com/${apiVersion}/${params.appId}/uploads`);
  startUrl.searchParams.set("file_name", params.filename);
  startUrl.searchParams.set("file_length", String(params.bytes.byteLength));
  startUrl.searchParams.set("file_type", params.mimeType);
  startUrl.searchParams.set("access_token", params.accessToken);

  const start = await fetch(startUrl.toString(), { method: "POST" });
  const startBody: any = await start.json().catch(() => ({}));
  if (!start.ok) {
    throw new Error(startBody?.error?.message || "Falha ao iniciar upload resumable na Meta.");
  }
  const sessionId = String(startBody?.id || "");
  if (!sessionId.startsWith("upload:")) {
    throw new Error("A Meta não devolveu um upload session id válido.");
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
  if (!upload.ok) {
    throw new Error(uploaded?.error?.message || "Falha ao enviar o binário do cabeçalho para a Meta.");
  }
  const handle = String(uploaded?.h || "").trim();
  if (!handle) throw new Error("A Meta não devolveu o handle (h) do arquivo.");
  return handle;
}

export async function resolveHeaderHandle(params: {
  format: TemplateMediaFormat;
  value: string;
  appId: string;
  accessToken: string;
  apiVersion?: string;
}): Promise<string> {
  const value = String(params.value || "").trim();
  if (!value) throw new Error("Informe a mídia de exemplo do cabeçalho.");
  if (looksLikeMetaUploadHandle(value)) return value;
  if (!looksLikeHttpUrl(value)) {
    throw new Error("Informe uma URL https pública do arquivo de exemplo, ou um handle já gerado pelo upload da Meta.");
  }
  const file = await fetchAndValidateTemplateMedia({ format: params.format, sourceUrl: value });
  return uploadTemplateMediaHandle({
    appId: params.appId,
    accessToken: params.accessToken,
    apiVersion: params.apiVersion,
    format: params.format,
    filename: file.filename,
    mimeType: file.mimeType,
    bytes: file.bytes,
  });
}
