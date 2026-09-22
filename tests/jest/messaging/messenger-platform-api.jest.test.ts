/// <reference types="jest" />
import {
  buildMessengerPayload,
  normalizeMessengerPsid,
} from "@/lib/chat-outbox.server";

describe("Messenger Platform Send API payload", () => {
  it("strips the fb_ prefix from PSIDs", () => {
    expect(normalizeMessengerPsid("fb_1234567890")).toBe("1234567890");
    expect(normalizeMessengerPsid("1234567890")).toBe("1234567890");
  });

  it("sends text with messaging_type RESPONSE as required by the Send API", () => {
    const payload = buildMessengerPayload("fb_PSID_1", {
      type: "text",
      text: { body: "hello, world!" },
    });

    expect(payload).toEqual({
      recipient: { id: "PSID_1" },
      messaging_type: "RESPONSE",
      message: { text: "hello, world!" },
    });
  });

  it("attaches reply_to.mid for threaded replies", () => {
    const payload = buildMessengerPayload("PSID_1", {
      type: "text",
      text: { body: "thanks" },
      reply_to_message_id: "m_mid.abc",
    });

    expect(payload.message).toEqual({
      text: "thanks",
      reply_to: { mid: "m_mid.abc" },
    });
  });

  it("builds reusable file attachments with type file", () => {
    const payload = buildMessengerPayload("PSID_1", {
      type: "document",
      document: { link: "https://example.com/file.pdf" },
    });

    expect(payload).toMatchObject({
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "file",
          payload: { url: "https://example.com/file.pdf", is_reusable: true },
        },
      },
    });
  });

  it("uses sender_action for reactions without messaging_type", () => {
    const payload = buildMessengerPayload("PSID_1", {
      type: "reaction",
      reaction: { message_id: "m_mid.abc", emoji: "love" },
    });

    expect(payload).toEqual({
      recipient: { id: "PSID_1" },
      sender_action: "react",
      payload: { message_id: "m_mid.abc", reaction: "love" },
    });
    expect(payload.messaging_type).toBeUndefined();
  });
});
