import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { buildInstagramOutboundPayload } from "../../src/lib/messaging/outbound/adapters/instagram.payload-builder";
import {
  buildInstagramGraphUrl,
  buildInstagramMeMessagesUrl,
  buildInstagramSendUrl,
} from "../../src/lib/messaging/outbound/adapters/instagram.api";

describe("Instagram Outbound Adapter", () => {
  it("builds text payload with RESPONSE type and no HUMAN_AGENT", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "text",
      text: { body: "Hello IG" },
    });

    expect(payload).toMatchObject({
      recipient: { id: "1086930670737976" },
      message_type: "RESPONSE",
      message: { text: "Hello IG" },
    });
    expect(payload.tag).toBeUndefined();
  });

  it("builds text payload with quick_replies limited to 13", () => {
    const quickReplies = Array.from({ length: 20 }, (_, i) => ({
      content_type: "text" as const,
      title: `Q${i}`,
      payload: `p${i}`,
    }));
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "text",
      text: { body: "Hello" },
      quick_replies: quickReplies,
    });

    expect((payload.message as any).quick_replies).toHaveLength(13);
  });

  it("does not include HUMAN_AGENT by default", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", { type: "text", text: { body: "Hi" } });
    expect(payload.message_type).toBe("RESPONSE");
    expect(payload.tag).toBeUndefined();
  });

  it("can include HUMAN_AGENT when explicitly requested", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", { type: "text", text: { body: "Hi" } }, {
      useHumanAgentTag: true,
    });
    expect(payload.message_type).toBe("MESSAGE_TAG");
    expect(payload.tag).toBe("HUMAN_AGENT");
  });

  it("builds image attachment payload with public url", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "image",
      image: { link: "https://www.example.com/image.jpg" },
    });
    expect(payload).toMatchObject({
      recipient: { id: "1086930670737976" },
      message: {
        attachment: {
          type: "image",
          payload: { url: "https://www.example.com/image.jpg" },
        },
      },
    });
  });

  it("sends gif as image attachment with public url", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "image",
      image: { link: "https://www.example.com/loop.gif" },
    });
    expect(payload.message).toMatchObject({
      attachment: { type: "image", payload: { url: "https://www.example.com/loop.gif" } },
    });
  });

  it("builds document attachment as file", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "document",
      document: { id: "DOC_ID" },
    });
    expect(payload.message).toMatchObject({
      attachment: { type: "file", payload: { attachment_id: "DOC_ID" } },
    });
  });

  it("Instagram Login envia mídia só com url e sem message_type", () => {
    const payload = buildInstagramOutboundPayload(
      "IGSID",
      { type: "video", video: { id: "SHOULD_IGNORE", link: "https://cdn.example.com/a.mp4" } },
      { authMode: "instagram_login" },
    );
    expect(payload.message_type).toBeUndefined();
    expect(payload.message).toMatchObject({
      attachment: { type: "video", payload: { url: "https://cdn.example.com/a.mp4" } },
    });
  });

  it("sticker sem arquivo vira like_heart", () => {
    const payload = buildInstagramOutboundPayload("IGSID", { type: "sticker" });
    expect(payload.message).toMatchObject({
      attachment: { type: "like_heart" },
    });
  });

  it("remove reação com unreact", () => {
    const payload = buildInstagramOutboundPayload("IGSID", {
      type: "reaction",
      reaction: { message_id: "mid.1", action: "unreact" },
    });
    expect(payload.sender_action).toBe("unreact");
    expect((payload.payload as { message_id: string }).message_id).toBe("mid.1");
  });

  it("private reply usa recipient.comment_id", () => {
    const payload = buildInstagramOutboundPayload("IGSID", {
      type: "text",
      text: { body: "Obrigado pelo comentário" },
      comment_id: "179123456789",
    });
    expect(payload.recipient).toEqual({ comment_id: "179123456789" });
  });

  it("generic template respeita 10 cards e 3 botões", () => {
    const payload = buildInstagramOutboundPayload(
      "IGSID",
      {
        type: "generic_template",
        template: {
          template_type: "generic",
          elements: Array.from({ length: 12 }, (_, i) => ({
            title: `Card ${i}`,
            buttons: [
              { type: "web_url", title: "A", url: "https://ex.com/a" },
              { type: "web_url", title: "B", url: "https://ex.com/b" },
              { type: "web_url", title: "C", url: "https://ex.com/c" },
              { type: "web_url", title: "D", url: "https://ex.com/d" },
            ],
          })),
        },
      },
      { authMode: "instagram_login" },
    );
    const elements = (payload.message as any).attachment.payload.elements;
    expect(elements).toHaveLength(10);
    expect(elements[0].buttons).toHaveLength(3);
  });

  it("não aplica HUMAN_AGENT no Instagram Login", () => {
    const payload = buildInstagramOutboundPayload(
      "IGSID",
      { type: "text", text: { body: "Hi" } },
      { authMode: "instagram_login", useHumanAgentTag: true },
    );
    expect(payload.message_type).toBeUndefined();
    expect(payload.tag).toBeUndefined();
  });
});

describe("buildInstagramGraphUrl", () => {
  it("produces the same Instagram Graph URL", () => {
    expect(buildInstagramGraphUrl("17841400000000000", "messages", "v26.0")).toBe(
      "https://graph.facebook.com/v26.0/17841400000000000/messages",
    );
  });
});

describe("buildInstagramSendUrl", () => {
  it("Facebook Login usa graph.facebook.com/{pageId}/messages", () => {
    expect(
      buildInstagramSendUrl({
        authMode: "facebook_login",
        pageId: "PAGE123",
        igUserId: "17841400000000000",
        graphVersion: "v26.0",
      }),
    ).toBe("https://graph.facebook.com/v26.0/PAGE123/messages");
  });

  it("Instagram Login usa graph.instagram.com/{igUserId}/messages", () => {
    expect(
      buildInstagramSendUrl({
        authMode: "instagram_login",
        igUserId: "17841400000000000",
        graphVersion: "v26.0",
      }),
    ).toBe("https://graph.instagram.com/v26.0/17841400000000000/messages");
  });
});
