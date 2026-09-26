/** Prefer a durable media reference over a short-lived Meta Graph id. */

export function pickPreferredMediaRef(
  ...candidates: Array<string | null | undefined>
): string {
  const values = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const dataUrl = values.find((value) => value.startsWith("data:"));
  if (dataUrl) return dataUrl;
  const stored = values.find((value) => value.includes("/api/storage/file"));
  if (stored) return stored;
  const remote = values.find(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
  );
  if (remote) return remote;
  const graphId = values.find((value) => /^\d{8,}$/.test(value));
  return graphId || values[0] || "";
}

export function decodeDataUrl(value: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value.trim());
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = match[2] === ";base64";
  const payload = match[3] || "";
  try {
    const buffer = Buffer.from(payload, isBase64 ? "base64" : "utf8");
    if (buffer.byteLength < 16) return null;
    return { mime, bytes: new Uint8Array(buffer) };
  } catch {
    return null;
  }
}

export function normalizeGraphScopedId(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^(ig_|fb_)/i, "");
}
