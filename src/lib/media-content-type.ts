import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".amr": "audio/amr",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".3gp": "video/3gpp",
};

function normalizeMimeType(value: unknown) {
  return typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : "";
}

export function resolveMediaContentType(options: {
  fileName?: string;
  declaredMimeType?: unknown;
  upstreamContentType?: string | null;
  bytes?: Uint8Array;
}) {
  const declared = normalizeMimeType(options.declaredMimeType);
  if (declared && declared !== "application/octet-stream") return declared;

  const extensionMimeType = options.fileName
    ? MIME_TYPES[path.extname(options.fileName).toLowerCase()]
    : "";
  if (extensionMimeType) return extensionMimeType;

  const upstream = normalizeMimeType(options.upstreamContentType);
  if (upstream && upstream !== "application/octet-stream") return upstream;

  const bytes = options.bytes || new Uint8Array();
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return "audio/ogg";
  }

  return declared || upstream || "application/octet-stream";
}
