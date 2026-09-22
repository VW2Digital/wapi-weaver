import { describe, expect, it } from "@jest/globals";
import {
  isInstagramPostOrReelUrl,
  isPlayableVideoSrc,
  resolveInstagramShareUrl,
} from "../../src/lib/chat-instagram-share";

describe("Instagram shared posts in chat", () => {
  it("detects permalinks that cannot be played as <video>", () => {
    expect(isInstagramPostOrReelUrl("https://www.instagram.com/reel/AbC123/")).toBe(true);
    expect(isInstagramPostOrReelUrl("https://www.instagram.com/p/AbC123/")).toBe(true);
    expect(isPlayableVideoSrc("https://www.instagram.com/reel/AbC123/")).toBe(false);
  });

  it("allows locally persisted mp4 files", () => {
    expect(isPlayableVideoSrc("/api/storage/file?path=tenant/clip.mp4")).toBe(true);
    expect(isPlayableVideoSrc("https://cdn.example/v/clip.mp4")).toBe(true);
    expect(isPlayableVideoSrc("https://lookaside.fbsbx.com/instagram/media")).toBe(true);
  });

  it("picks the Instagram permalink from mixed metadata", () => {
    expect(
      resolveInstagramShareUrl([
        "wamid.123",
        "https://lookaside.fbsbx.com/not-a-post",
        "https://instagram.com/p/XYZ/",
      ]),
    ).toBe("https://instagram.com/p/XYZ/");
  });
});
