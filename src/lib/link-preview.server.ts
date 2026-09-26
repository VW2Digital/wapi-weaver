import { assertPublicHttpUrl } from "@/lib/whatsapp-template-media";
import type { LinkPreviewPayload } from "@/lib/chat-linkify";
import { isInstagramPostOrReelUrl } from "@/lib/chat-instagram-share";

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

export function previewFromInstagramOembed(
  permalink: string,
  body: Record<string, unknown>,
): LinkPreviewPayload | null {
  const image = typeof body.thumbnail_url === "string" ? body.thumbnail_url.trim() : "";
  if (!/^https:\/\//i.test(image)) return null;
  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    (typeof body.author_name === "string" && body.author_name.trim()) ||
    "Instagram";
  return {
    url: permalink,
    title: title.slice(0, 140),
    description: "",
    image,
    siteName: "Instagram",
  };
}

export async function fetchInstagramOembedPreview(
  permalink: string,
  accessToken: string,
  graphVersion = "v26.0",
): Promise<LinkPreviewPayload | null> {
  const version = /^v\d+\.\d+$/.test(graphVersion) ? graphVersion : "v26.0";
  const endpoint = new URL(`https://graph.facebook.com/${version}/instagram_oembed`);
  endpoint.searchParams.set("url", permalink);
  endpoint.searchParams.set("access_token", accessToken);
  endpoint.searchParams.set("omitscript", "true");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return null;
    return previewFromInstagramOembed(permalink, json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLinkPreview(
  rawUrl: string,
  options?: { instagramAccessToken?: string | null; graphVersion?: string | null },
): Promise<LinkPreviewPayload> {
  const url = await assertPublicHttpUrl(rawUrl);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  if (isInstagramPostOrReelUrl(key) && options?.instagramAccessToken) {
    const oembed = await fetchInstagramOembedPreview(
      key,
      options.instagramAccessToken,
      options.graphVersion || "v26.0",
    );
    if (oembed?.image) {
      cache.set(key, { at: Date.now(), data: oembed });
      return oembed;
    }
  }

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
  const description = metaContent(html, ["og:description", "twitter:description", "description"]).slice(
    0,
    280,
  );
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
