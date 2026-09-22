import { createHmac, timingSafeEqual } from "node:crypto";
import { JWT_SECRET } from "@/lib/jwt-secret";

export const INSTAGRAM_SIGNED_MEDIA_TTL_SECONDS = 30 * 60;

function signingSecret() {
  return JWT_SECRET;
}

function normalizeMediaPath(input: string) {
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Caminho de mídia inválido.");
  }
  return normalized;
}

export function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false;
    }
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolvePublicAppUrl(env: NodeJS.ProcessEnv = process.env) {
  const raw = (env.APP_URL || "").trim().replace(/\/$/, "");
  if (!raw || !isPublicHttpsUrl(raw)) {
    throw new Error(
      "APP_URL precisa ser um HTTPS público para a Meta baixar a mídia do Instagram.",
    );
  }
  return raw;
}

export function extractLocalStoragePath(link: string | null | undefined) {
  if (!link) return null;
  try {
    const url = link.startsWith("http://") || link.startsWith("https://")
      ? new URL(link)
      : new URL(link, "https://invalid.local");
    if (!url.pathname.includes("/api/storage/file")) return null;
    const path = url.searchParams.get("path");
    return path ? normalizeMediaPath(decodeURIComponent(path)) : null;
  } catch {
    return null;
  }
}

function sign(tenantId: string, mediaPath: string, exp: number) {
  return createHmac("sha256", signingSecret())
    .update(`${tenantId}\n${mediaPath}\n${exp}`)
    .digest("hex");
}

export function createInstagramSignedMediaUrl(input: {
  tenantId: string;
  mediaPath: string;
  ttlSeconds?: number;
  now?: Date;
  baseUrl?: string;
}) {
  const mediaPath = normalizeMediaPath(input.mediaPath);
  const tenantPrefix = `${input.tenantId}/`;
  if (mediaPath !== input.tenantId && !mediaPath.startsWith(tenantPrefix)) {
    throw new Error("A mídia não pertence a este tenant.");
  }
  const exp = Math.floor((input.now || new Date()).getTime() / 1000) +
    (input.ttlSeconds ?? INSTAGRAM_SIGNED_MEDIA_TTL_SECONDS);
  const sig = sign(input.tenantId, mediaPath, exp);
  const baseUrl = (input.baseUrl || resolvePublicAppUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({
    path: mediaPath,
    exp: String(exp),
    sig,
  });
  return `${baseUrl}/api/public/instagram-media?${params.toString()}`;
}

export function resolveInstagramOutboundMediaUrl(input: {
  tenantId: string;
  localFilePath?: string | null;
  link?: string | null;
}) {
  const mediaPath = input.localFilePath
    ? normalizeMediaPath(input.localFilePath)
    : extractLocalStoragePath(input.link);
  if (mediaPath) {
    return createInstagramSignedMediaUrl({
      tenantId: input.tenantId,
      mediaPath,
    });
  }
  if (input.link && isPublicHttpsUrl(input.link) && !extractLocalStoragePath(input.link)) {
    return input.link;
  }
  throw new Error(
    "A Meta precisa de uma URL HTTPS pública temporária. A mídia local autenticada não pode ser enviada.",
  );
}

export function applyInstagramSignedMediaLinks(
  payload: Record<string, any>,
  tenantId: string,
) {
  const next: Record<string, any> = { ...payload };
  const localPath = typeof next.local_file_path === "string" ? next.local_file_path : null;
  for (const key of ["image", "audio", "video", "document", "sticker"]) {
    const media = next[key];
    if (!media || typeof media !== "object") continue;
    if (!media.link && !localPath) continue;
    next[key] = {
      ...media,
      id: null,
      link: resolveInstagramOutboundMediaUrl({
        tenantId,
        localFilePath: localPath,
        link: media.link,
      }),
    };
  }
  return next;
}

export function verifyInstagramSignedMedia(input: {
  path: string | null;
  exp: string | null;
  sig: string | null;
  now?: Date;
}) {
  if (!input.path || !input.exp || !input.sig) {
    throw Object.assign(new Error("Assinatura de mídia ausente."), { statusCode: 401 });
  }
  const mediaPath = normalizeMediaPath(input.path);
  const exp = Number(input.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor((input.now || new Date()).getTime() / 1000)) {
    throw Object.assign(new Error("URL temporária expirada."), { statusCode: 401 });
  }
  const tenantId = mediaPath.split("/")[0];
  if (!tenantId) {
    throw Object.assign(new Error("Caminho de mídia inválido."), { statusCode: 400 });
  }
  const expected = sign(tenantId, mediaPath, exp);
  const provided = input.sig.toLowerCase();
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw Object.assign(new Error("Assinatura de mídia inválida."), { statusCode: 403 });
  }
  return { tenantId, mediaPath, exp };
}
