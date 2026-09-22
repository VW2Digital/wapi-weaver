const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
};

const ACCEPTED_INSTAGRAM_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/avi",
  "video/3gpp",
  "video/3gpp2",
]);

export function inferInstagramVideoMime(declaredMime: string, fileName: string) {
  const mime = (declaredMime || "").toLowerCase().split(";")[0].trim();
  if (mime && mime !== "application/octet-stream" && mime.startsWith("video/")) {
    return mime;
  }
  const ext = (fileName || "").toLowerCase().split(".").pop() || "";
  return VIDEO_MIME_BY_EXT[ext] || mime;
}

export function isAcceptedInstagramVideoMime(mime: string) {
  return ACCEPTED_INSTAGRAM_VIDEO_MIMES.has((mime || "").toLowerCase().split(";")[0].trim());
}

export function looksLikeFtypContainer(bytes: Uint8Array) {
  if (bytes.length < 8) return false;
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}
