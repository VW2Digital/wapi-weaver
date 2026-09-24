export type LinkPreviewPayload = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
};

export const HTTP_URL_RE = /https?:\/\/[^\s<]+/gi;

export function normalizeExtractedUrl(raw: string): string | null {
  let value = String(raw || "").trim();
  if (!value) return null;
  value = value.replace(/[),.;!?]+$/g, "");
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractHttpUrls(text: string, max = 3): string[] {
  const matches = String(text || "").match(HTTP_URL_RE) || [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const url = normalizeExtractedUrl(match);
    if (!url) continue;
    const key = url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
    if (unique.length >= max) break;
  }
  return unique;
}

export function linkifyHtml(escapedHtml: string): string {
  return String(escapedHtml || "").replace(HTTP_URL_RE, (raw) => {
    const href = normalizeExtractedUrl(raw);
    if (!href) return raw;
    const display = raw.replace(/[),.;!?]+$/g, "");
    const trailing = raw.slice(display.length);
    const safeHref = href.replace(/"/g, "%22");
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 font-medium text-[color:var(--bubble-action)] hover:opacity-80 break-all">${display}</a>${trailing}`;
  });
}
