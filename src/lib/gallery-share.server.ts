import { createHmac, timingSafeEqual } from "node:crypto";
import { JWT_SECRET } from "@/lib/jwt-secret";

export const GALLERY_SHARE_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizeMediaPath(input: string) {
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Caminho de mídia inválido.");
  }
  return normalized;
}

function sign(tenantId: string, mediaPath: string, exp: number) {
  return createHmac("sha256", JWT_SECRET)
    .update(`gallery\n${tenantId}\n${mediaPath}\n${exp}`)
    .digest("hex");
}

export function createGalleryShareUrl(input: {
  tenantId: string;
  mediaPath: string;
  origin: string;
  ttlSeconds?: number;
  now?: Date;
}) {
  const mediaPath = normalizeMediaPath(input.mediaPath);
  if (mediaPath !== input.tenantId && !mediaPath.startsWith(`${input.tenantId}/`)) {
    throw new Error("A mídia não pertence a este tenant.");
  }
  const exp =
    Math.floor((input.now || new Date()).getTime() / 1000) +
    (input.ttlSeconds ?? GALLERY_SHARE_TTL_SECONDS);
  const sig = sign(input.tenantId, mediaPath, exp);
  const origin = input.origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    path: mediaPath,
    exp: String(exp),
    sig,
  });
  return `${origin}/api/public/gallery-media?${params.toString()}`;
}

export function verifyGalleryShare(input: {
  path: string | null;
  exp: string | null;
  sig: string | null;
  now?: Date;
}) {
  if (!input.path || !input.exp || !input.sig) {
    throw Object.assign(new Error("Assinatura de compartilhamento ausente."), { statusCode: 401 });
  }
  const mediaPath = normalizeMediaPath(input.path);
  const exp = Number(input.exp);
  if (!Number.isFinite(exp) || exp <= Math.floor((input.now || new Date()).getTime() / 1000)) {
    throw Object.assign(new Error("Link de compartilhamento expirado."), { statusCode: 401 });
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
    throw Object.assign(new Error("Assinatura de compartilhamento inválida."), { statusCode: 403 });
  }
  return { tenantId, mediaPath, exp };
}
