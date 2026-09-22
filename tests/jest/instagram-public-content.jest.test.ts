import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  INSTAGRAM_HASHTAG_MEDIA_FIELDS,
  INSTAGRAM_PUBLIC_REQUIRED_SCOPES,
  INSTAGRAM_STOREFRONT_UPDATE_SCHEMA,
  canSearchUniqueHashtag,
  classifyPublicContentApproval,
  instagramPublicGraphRequest,
  isPublicStorefrontAvailable,
  normalizeInstagramHashtag,
  retireStorefrontSlug,
} from "../../src/lib/instagram-public-content.functions";
import {
  mergeHashtagSearchItems,
  resolveInstagramPublicPreview,
} from "../../src/lib/instagram-public-preview";

describe("Instagram Public Content contracts", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests only the scopes required for hashtag search", () => {
    expect(INSTAGRAM_PUBLIC_REQUIRED_SCOPES).toEqual(["instagram_basic", "pages_show_list"]);
  });

  it("requests only fields supported by Meta hashtag media edges", () => {
    expect(INSTAGRAM_HASHTAG_MEDIA_FIELDS).toBe(
      "id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}",
    );
    expect(INSTAGRAM_HASHTAG_MEDIA_FIELDS).not.toContain("username");
  });

  it.each([
    ["#MinhaMarca", "minhamarca"],
    ["###CAFÉ_2026", "café_2026"],
    ["  produto  ", "produto"],
  ])("normalizes hashtag %s", (input, expected) => {
    expect(normalizeInstagramHashtag(input)).toBe(expected);
  });

  it("allows repeated hashtags without consuming a new seven-day slot", () => {
    const active = Array.from({ length: 30 }, (_, index) => `marca_${index}`);
    expect(canSearchUniqueHashtag(active, "#MARCA_12")).toBe(true);
    expect(canSearchUniqueHashtag(active, "#nova_marca")).toBe(false);
  });

  it("classifies Meta permission errors as App Review required", () => {
    expect(classifyPublicContentApproval(10)).toBe("required");
    expect(classifyPublicContentApproval(200)).toBe("required");
    expect(classifyPublicContentApproval(190)).toBe("error");
  });

  it("sends tokens only in the Authorization header", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "hashtag-id" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await instagramPublicGraphRequest({
      path: "ig_hashtag_search",
      accessToken: "secret-user-token",
      params: { user_id: "ig-user", q: "bliv" },
      attempts: 1,
    });

    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).not.toContain("secret-user-token");
    expect(url.searchParams.get("q")).toBe("bliv");
    expect(options.headers).toEqual({ Authorization: "Bearer secret-user-token" });
  });
});

describe("Instagram public media preview", () => {
  it("never uses a video file as the image cover", () => {
    const preview = resolveInstagramPublicPreview({
      media_type: "VIDEO",
      media_url: "https://scontent.cdninstagram.com/v/clip.mp4",
      thumbnail_url: null,
      children_json: [],
    });
    expect(preview.kind).toBe("video");
    expect(preview.previewUrl).toBeNull();
    expect(preview.videoUrl).toContain(".mp4");
  });

  it("uses the first carousel child image as cover", () => {
    const preview = resolveInstagramPublicPreview({
      media_type: "CAROUSEL_ALBUM",
      media_url: "https://scontent.cdninstagram.com/v/clip.mp4",
      thumbnail_url: null,
      children_json: [
        { media_type: "IMAGE", media_url: "https://scontent.cdninstagram.com/v/cover.jpg" },
        { media_type: "VIDEO", media_url: "https://scontent.cdninstagram.com/v/item.mp4" },
      ],
    });
    expect(preview.kind).toBe("carousel");
    expect(preview.previewUrl).toContain("cover.jpg");
    expect(preview.childCount).toBe(2);
  });

  it("prefers a video thumbnail over the playable file", () => {
    const preview = resolveInstagramPublicPreview({
      media_type: "VIDEO",
      media_url: "https://scontent.cdninstagram.com/v/clip.mp4",
      thumbnail_url: "https://scontent.cdninstagram.com/v/thumb.jpg",
      children_json: [],
    });
    expect(preview.previewUrl).toContain("thumb.jpg");
  });

  it("parses children_json stored as a JSON string", () => {
    const preview = resolveInstagramPublicPreview({
      media_type: "CAROUSEL_ALBUM",
      media_url: null,
      thumbnail_url: null,
      children_json: JSON.stringify([
        { media_type: "VIDEO", media_url: "https://cdn.example/clip.mp4", thumbnail_url: "https://cdn.example/thumb.jpg" },
      ]),
    });
    expect(preview.previewUrl).toContain("thumb.jpg");
  });

  it("appends unique pages and ignores duplicates", () => {
    const first = [{ id: "a" }, { id: "b" }];
    const second = [{ id: "b" }, { id: "c" }];
    expect(mergeHashtagSearchItems(first, second, true).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(mergeHashtagSearchItems(first, second, false).map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("Instagram storefront lifecycle", () => {
  it("validates storefront settings before persistence", () => {
    expect(() =>
      INSTAGRAM_STOREFRONT_UPDATE_SCHEMA.parse({
        enabled: true,
        title: "  ",
        subtitle: null,
        layout: "grid",
        columnsCount: 3,
        showCaptions: true,
        showHashtags: true,
        maxItems: 12,
        theme: "auto",
      }),
    ).toThrow();
    expect(
      INSTAGRAM_STOREFRONT_UPDATE_SCHEMA.parse({
        enabled: false,
        title: "Loja Bliv",
        subtitle: "Galeria",
        layout: "masonry",
        columnsCount: 4,
        showCaptions: false,
        showHashtags: true,
        maxItems: 8,
        theme: "dark",
      }).title,
    ).toBe("Loja Bliv");
  });

  it("retires the public slug on logical delete so the old URL cannot match", () => {
    const retired = retireStorefrontSlug("minha-loja-abcd1234", "11111111-2222-3333-4444-555555555555");
    expect(retired).toContain("-deleted-");
    expect(retired).not.toBe("minha-loja-abcd1234");
  });

  it("hides unpublished and deleted storefronts from the public query contract", () => {
    expect(isPublicStorefrontAvailable({ enabled: 1, deleted_at: null })).toBe(true);
    expect(isPublicStorefrontAvailable({ enabled: 0, deleted_at: null })).toBe(false);
    expect(isPublicStorefrontAvailable({ enabled: 1, deleted_at: "2026-09-22T12:00:00Z" })).toBe(false);
  });
});
