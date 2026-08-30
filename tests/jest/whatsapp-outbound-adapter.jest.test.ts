import { describe, expect, jest, test } from "@jest/globals";
import { buildWhatsAppOutboundPayload } from "../../src/lib/messaging/outbound/adapters/whatsapp.payload-builder";
import { WhatsAppClient } from "../../src/lib/messaging/outbound/adapters/whatsapp.api";

describe("WhatsApp Outbound Adapter", () => {
  test("build text payload matches prior behavior", () => {
    const payload = buildWhatsAppOutboundPayload("5511999999999", {
      type: "text",
      text: { body: "Hello", preview_url: false },
    } as any);

    expect(payload).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511999999999",
      type: "text",
      text: { body: "Hello", preview_url: false },
    });
  });

  test("build image payload matches prior behavior", () => {
    const payload = buildWhatsAppOutboundPayload("5511999999999", {
      type: "image",
      image: { id: "MEDIA_ID" },
    } as any);

    expect(payload.image).toEqual({ id: "MEDIA_ID" });
  });

  test("build audio voice payload includes voice:true", () => {
    const payload = buildWhatsAppOutboundPayload("5511999999999", {
      type: "audio",
      audio: { id: "MEDIA_ID", voice: true },
    } as any);

    expect(payload.audio).toEqual({ id: "MEDIA_ID", voice: true });
  });
});

describe("WhatsApp Client", () => {
  test("client extracts message id from Meta response", async () => {
    const fakeFetch = jest.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ wa_id: "5511999999999" }],
          messages: [{ id: "wamid.HBgMM" }],
        }),
    } as unknown as Response);
    (global as any).fetch = fakeFetch;

    const client = new WhatsAppClient({
      phoneNumberId: "123456",
      accessToken: "WA_TOKEN",
      graphVersion: "v26.0",
    });

    const result = await client.send({
      recipient: "5511999999999",
      payload: { type: "text", text: { body: "Hello" } } as any,
    });

    expect(result.providerMessageId).toBe("wamid.HBgMM");
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v26.0/123456/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer WA_TOKEN",
        }),
      }),
    );
  });
});
