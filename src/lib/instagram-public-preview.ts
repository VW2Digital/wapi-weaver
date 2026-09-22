export type InstagramPublicMediaChild = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

export type InstagramPublicPreviewKind = "image" | "video" | "carousel";

export type InstagramPublicPreview = {
  kind: InstagramPublicPreviewKind;
  previewUrl: string | null;
  videoUrl: string | null;
  childCount: number;
  children: InstagramPublicMediaChild[];
};

export function looksLikeVideoUrl(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

export function isInstagramVideoType(mediaType?: string | null) {
  const type = String(mediaType || "").toUpperCase();
  return type === "VIDEO" || type === "REELS";
}

export function isInstagramCarouselType(mediaType?: string | null) {
  const type = String(mediaType || "").toUpperCase();
  return type === "CAROUSEL_ALBUM" || type === "CAROUSEL";
}

function childPreview(child: InstagramPublicMediaChild) {
  if (isInstagramVideoType(child.media_type) || looksLikeVideoUrl(child.media_url)) {
    return {
      previewUrl: child.thumbnail_url || null,
      videoUrl: child.media_url || null,
    };
  }
  return {
    previewUrl: child.thumbnail_url || child.media_url || null,
    videoUrl: null,
  };
}

export function resolveInstagramPublicPreview(item: {
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  children_json?: InstagramPublicMediaChild[] | string | null;
}): InstagramPublicPreview {
  let children: InstagramPublicMediaChild[] = [];
  if (Array.isArray(item.children_json)) {
    children = item.children_json;
  } else if (typeof item.children_json === "string" && item.children_json.trim()) {
    try {
      const parsed = JSON.parse(item.children_json) as InstagramPublicMediaChild[];
      children = Array.isArray(parsed) ? parsed : [];
    } catch {
      children = [];
    }
  }
  const firstUsable = children.map(childPreview).find((entry) => entry.previewUrl);
  const childCount = children.length;
  const ownThumb = item.thumbnail_url || null;
  const ownMedia = looksLikeVideoUrl(item.media_url) ? null : item.media_url || null;

  if (isInstagramVideoType(item.media_type)) {
    return {
      kind: "video",
      previewUrl: ownThumb || firstUsable?.previewUrl || null,
      videoUrl: item.media_url || firstUsable?.videoUrl || null,
      childCount,
      children,
    };
  }

  if (isInstagramCarouselType(item.media_type)) {
    return {
      kind: "carousel",
      previewUrl: ownThumb || firstUsable?.previewUrl || ownMedia || null,
      videoUrl: firstUsable?.videoUrl || null,
      childCount: Math.max(childCount, 1),
      children,
    };
  }

  return {
    kind: "image",
    previewUrl: ownThumb || ownMedia || firstUsable?.previewUrl || null,
    videoUrl: null,
    childCount,
    children,
  };
}

export function mergeHashtagSearchItems<T extends { id: string }>(
  current: T[] | undefined,
  incoming: T[],
  append: boolean,
) {
  if (!append || !current?.length) return incoming;
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}
