export type GalleryKind = "image" | "video" | "audio" | "document";

export type GalleryFile = {
  path: string;
  name: string;
  size: number;
  mtime: number;
  kind: GalleryKind;
};

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".3gp"]);
const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".aac"]);

export const GALLERY_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

export function fileExtension(name: string) {
  const dot = String(name || "").lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot).toLowerCase();
}

export function classifyGalleryKind(name: string): GalleryKind {
  const ext = fileExtension(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "document";
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeGalleryFileName(name: string) {
  const base = String(name || "arquivo")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return base || "arquivo";
}
