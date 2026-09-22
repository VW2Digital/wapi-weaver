import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  INSTAGRAM_HASHTAG_MEDIA_FIELDS,
  INSTAGRAM_PUBLIC_REQUIRED_SCOPES,
  canSearchUniqueHashtag,
  classifyPublicContentApproval,
  instagramPublicGraphRequest,
  normalizeInstagramHashtag,
} from "../../src/lib/instagram-public-content.functions";

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
