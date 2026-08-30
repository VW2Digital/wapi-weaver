import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { buildInstagramOutboundPayload } from "../../src/lib/messaging/outbound/adapters/instagram.payload-builder";
import { buildInstagramGraphUrl } from "../../src/lib/messaging/outbound/adapters/instagram.api";

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

  it("builds image attachment payload", () => {
    const payload = buildInstagramOutboundPayload("1086930670737976", {
      type: "image",
      image: { id: "MEDIA_ID" },
    });
    expect(payload.message).toMatchObject({
      attachment: { type: "image", payload: { attachment_id: "MEDIA_ID" } },
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
});

describe("buildInstagramGraphUrl", () => {
  it("produces the same Instagram Graph URL", () => {
    expect(buildInstagramGraphUrl("17841400000000000", "messages", "v26.0")).toBe(
      "https://graph.facebook.com/v26.0/17841400000000000/messages",
    );
  });
});
