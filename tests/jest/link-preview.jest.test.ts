import { describe, expect, it } from "@jest/globals";
import { previewFromInstagramOembed } from "../../src/lib/link-preview.server";

describe("instagram oembed preview", () => {
  it("maps thumbnail_url from Graph oEmbed", () => {
    const preview = previewFromInstagramOembed("https://www.instagram.com/p/ABC/", {
      thumbnail_url: "https://scontent.cdninstagram.com/v/t51.thumb.jpg",
      title: "Post",
      author_name: "loja",
    });
    expect(preview).toEqual({
      url: "https://www.instagram.com/p/ABC/",
      title: "Post",
      description: "",
      image: "https://scontent.cdninstagram.com/v/t51.thumb.jpg",
      siteName: "Instagram",
    });
  });

  it("rejects missing or non-https thumbnails", () => {
    expect(
      previewFromInstagramOembed("https://www.instagram.com/p/ABC/", { thumbnail_url: "http://x" }),
    ).toBeNull();
    expect(previewFromInstagramOembed("https://www.instagram.com/p/ABC/", {})).toBeNull();
  });
});
