import { describe, expect, it } from "@jest/globals";
import { buildWhatsAppCloudReadPayload } from "../../src/lib/chat.functions";

describe("WhatsApp Cloud typing indicator + read receipt", () => {
  it("builds the official read receipt body without typing", () => {
    expect(buildWhatsAppCloudReadPayload({ messageId: "wamid.ABC" })).toEqual({
      messaging_product: "whatsapp",
      status: "read",
      message_id: "wamid.ABC",
    });
  });

  it("includes typing_indicator type text when requested", () => {
    expect(
      buildWhatsAppCloudReadPayload({
        messageId: "wamid.ABC",
        showTypingIndicator: true,
      }),
    ).toEqual({
      messaging_product: "whatsapp",
      status: "read",
      message_id: "wamid.ABC",
      typing_indicator: { type: "text" },
    });
  });
});
