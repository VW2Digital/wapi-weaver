import { assertPublicHttpUrl } from "@/lib/whatsapp-template-media";
import type { LinkPreviewPayload } from "@/lib/chat-linkify";

const cache = new Map<string, { at: number; data: LinkPreviewPayload }>();
const CACHE_MS = 30 * 60 * 1000;

function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const prop = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const prop2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    );
    const a = html.match(prop)?.[1] || html.match(prop2)?.[1];
    if (a) return decodeHtml(a.trim());
  }
  return "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeHtml(m[1].trim()) : "";
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewPayload> {
  const url = await assertPublicHttpUrl(rawUrl);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(key, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5",
        "User-Agent": "Mozilla/5.0 (compatible; BlivCRM/1.0; +https://app.blivcrm.com)",
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  const host = url.hostname.replace(/^www\./, "");

  if (ctype.startsWith("image/")) {
    const data = { url: key, title: host, description: "", image: key, siteName: host };
    cache.set(key, { at: Date.now(), data });
    return data;
  }

  const html = (await res.text()).slice(0, 250_000);
  const title = metaContent(html, ["og:title", "twitter:title"]) || titleTag(html) || host;
  const description = metaContent(html, ["og:description", "twitter:description", "description"]).slice(0, 280);
  const siteName = metaContent(html, ["og:site_name"]) || host;
  let image = metaContent(html, ["og:image", "og:image:url", "twitter:image"]);
  if (image) {
    try {
      image = new URL(image, key).toString();
      if (!/^https?:\/\//i.test(image)) image = "";
    } catch {
      image = "";
    }
  }

  const data: LinkPreviewPayload = {
    url: key,
    title: title.slice(0, 140),
    description,
    image: image || null,
    siteName: siteName.slice(0, 80),
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
