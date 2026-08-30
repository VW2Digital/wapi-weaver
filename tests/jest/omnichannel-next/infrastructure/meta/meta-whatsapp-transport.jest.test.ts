import { describe, expect, test } from "@jest/globals";
import { MetaWhatsAppTransport } from "@/lib/omnichannel-next/infrastructure/meta/whatsapp";
import { FakeHttpClient, FakeCredentialResolver } from "./test-fakes";

const PHONE_ID = "1107720082434785";
const RECIPIENT = "5511999999999";
const CRED_REF = "wa-cred-ref";
const TOKEN = "WA_TOKEN_SENTINEL";

describe("MetaWhatsAppTransport", () => {
  function buildTransport() {
    const http = new FakeHttpClient();
    const credentials = new FakeCredentialResolver();
    credentials.addToken(CRED_REF, TOKEN);
    const transport = new MetaWhatsAppTransport(
      { graphApiVersion: "25.0", graphHost: "graph.facebook.com" },
      http,
      credentials,
    );
    return { http, credentials, transport };
  }

  test("sends text message using official contract", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      200,
      { messages: [{ id: "wamid.XXX" }] },
    );

    const result = await transport.send({
      recipient: RECIPIENT,
      sender: PHONE_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "hello" },
    });

    expect(result.providerMessageId).toBe("wamid.XXX");
    expect(http.requests).toHaveLength(1);

    const req = http.requests[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe(`https://graph.facebook.com/v25.0/${PHONE_ID}/messages`);
    expect(req.headers?.["Content-Type"]).toBe("application/json");
    expect(req.headers?.Authorization).toBe("Bearer WA_TOKEN_SENTINEL");

    const body = req.body as Record<string, unknown>;
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.recipient_type).toBe("individual");
    expect(body.to).toBe(RECIPIENT);
    expect(body.type).toBe("text");
    expect((body.text as { body: string }).body).toBe("hello");
  });

  test("uses sender as phone number id, not recipient", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      200,
      { messages: [{ id: "wamid.YYY" }] },
    );

    await transport.send({
      recipient: RECIPIENT,
      sender: PHONE_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "ok" },
    });

    const req = http.requests[0];
    expect(req.url).toContain(PHONE_ID);
    expect((req.body as { to: string }).to).toBe(RECIPIENT);
  });

  test("does not send tokens in payload", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      200,
      { messages: [{ id: "wamid.ZZZ" }] },
    );

    await transport.send({
      recipient: RECIPIENT,
      sender: PHONE_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "ok" },
    });

    const raw = JSON.stringify(http.requests[0].body);
    const headers = JSON.stringify(http.requests[0].headers);
    expect(raw).not.toContain("WA_TOKEN_SENTINEL");
    expect(raw).not.toContain("wa-cred-ref");
    expect(headers).not.toContain("wa-cred-ref");
  });

  test("throws safe error on 400", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      400,
      { error: { code: 100, message: "Invalid parameter" } },
    );

    await expect(
      transport.send({
        recipient: RECIPIENT,
        sender: PHONE_ID,
        credentialReference: CRED_REF,
        message: { type: "text", text: "ok" },
      }),
    ).rejects.toThrow("META_WHATSAPP_400");
  });

  test("classifies 429 as retryable", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      429,
      { error: { code: 4, message: "Rate limit" } },
    );

    try {
      await transport.send({
        recipient: RECIPIENT,
        sender: PHONE_ID,
        credentialReference: CRED_REF,
        message: { type: "text", text: "ok" },
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.context.httpStatus).toBe(429);
      expect(error.context.retryable).toBe(true);
    }
  });

  test("classifies 500 as retryable", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
      500,
      { error: { code: 1, message: "Internal server error" } },
    );

    try {
      await transport.send({
        recipient: RECIPIENT,
        sender: PHONE_ID,
        credentialReference: CRED_REF,
        message: { type: "text", text: "ok" },
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.context.httpStatus).toBe(500);
      expect(error.context.retryable).toBe(true);
    }
  });
});
