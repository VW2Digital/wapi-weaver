import { describe, expect, it } from "@jest/globals";
import { resolveStoredMediaAttachment } from "../../src/lib/chat.functions";

describe("Instagram chat media rendering", () => {
  it.each(["image", "audio", "video"])(
    "resolves a canonical %s attachment before the local download finishes",
    (type) => {
      expect(
        resolveStoredMediaAttachment(
          {
            primaryAttachment: {
              type,
              providerMediaId: `${type}-id`,
              remoteUrl: `https://lookaside.fbsbx.com/${type}`,
              mimeType: `${type}/test`,
            },
            attachments: [],
          },
          type,
        ),
      ).toEqual({
        id: `${type}-id`,
        link: `https://lookaside.fbsbx.com/${type}`,
        caption: null,
        mime_type: `${type}/test`,
        filename: null,
      });
    },
  );

  it("prefers the persisted local media URL after the download finishes", () => {
    expect(
      resolveStoredMediaAttachment(
        {
          audio: {
            link: "/api/storage/file?path=tenant/audio.mp3",
            mime_type: "audio/mpeg",
          },
          primaryAttachment: {
            type: "audio",
            remoteUrl: "https://lookaside.fbsbx.com/temporary-audio",
          },
        },
        "audio",
      ),
    ).toEqual({
      link: "/api/storage/file?path=tenant/audio.mp3",
      mime_type: "audio/mpeg",
    });
  });

  it("does not reuse an attachment from another media type", () => {
    expect(
      resolveStoredMediaAttachment(
        {
          primaryAttachment: {
            type: "video",
            remoteUrl: "https://lookaside.fbsbx.com/video",
          },
        },
        "image",
      ),
    ).toBeNull();
  });
});
