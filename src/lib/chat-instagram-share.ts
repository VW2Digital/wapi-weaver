export function isInstagramPostOrReelUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value, "https://www.instagram.com");
    const host = parsed.hostname.replace(/^www\./i, "");
    if (host !== "instagram.com" && host !== "instagr.am") return false;
    return /\/(p|reel|reels|tv|stories)\//i.test(parsed.pathname);
  } catch {
    return /instagram\.com\/(p|reel|reels|tv|stories)\//i.test(value);
  }
}

export function isPlayableVideoSrc(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim();
  if (isInstagramPostOrReelUrl(value)) return false;
  if (value.startsWith("/api/storage") || value.startsWith("/uploads")) return true;
  if (/\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(value)) return true;
  return /lookaside\.fbsbx\.com|scontent/i.test(value);
}

export function resolveInstagramShareUrl(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (isInstagramPostOrReelUrl(value)) return String(value).trim();
  }
  return null;
}
