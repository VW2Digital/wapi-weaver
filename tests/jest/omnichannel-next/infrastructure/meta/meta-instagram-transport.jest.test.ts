import { describe, expect, test } from "@jest/globals";
import { MetaInstagramTransport } from "@/lib/omnichannel-next/infrastructure/meta/instagram";
import { FakeHttpClient, FakeCredentialResolver } from "./test-fakes";

const SENDER_ID = "IG_SENDER_123";
const RECIPIENT_ID = "IGSID_456";
const CRED_REF = "ig-cred-ref";
const TOKEN = "IG_TOKEN_SENTINEL";

describe("MetaInstagramTransport", () => {
  function buildTransport() {
    const http = new FakeHttpClient();
    const credentials = new FakeCredentialResolver();
    credentials.addToken(CRED_REF, TOKEN);
    const transport = new MetaInstagramTransport(
      { graphApiVersion: "25.0", graphHost: "graph.instagram.com" },
      http,
      credentials,
    );
    return { http, credentials, transport };
  }

  test("sends text message using Instagram Messaging API contract", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.instagram.com/v25.0/${SENDER_ID}/messages`,
      200,
      { message_id: "ig-mid-789" },
    );

    const result = await transport.send({
      recipient: RECIPIENT_ID,
      sender: SENDER_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "hello" },
    });

    expect(result.providerMessageId).toBe("ig-mid-789");
    expect(http.requests).toHaveLength(1);

    const req = http.requests[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe(`https://graph.instagram.com/v25.0/${SENDER_ID}/messages`);
    expect(req.headers?.["Content-Type"]).toBe("application/json");
    expect(req.headers?.Authorization).toBe("Bearer IG_TOKEN_SENTINEL");

    const body = req.body as Record<string, unknown>;
    expect(body).toEqual({
      recipient: { id: RECIPIENT_ID },
      message: { text: "hello" },
    });
  });

  test("does not include HUMAN_AGENT or MESSAGE_TAG by default", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.instagram.com/v25.0/${SENDER_ID}/messages`,
      200,
      { message_id: "ig-mid-000" },
    );

    await transport.send({
      recipient: RECIPIENT_ID,
      sender: SENDER_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "hello" },
    });

    const raw = JSON.stringify(http.requests[0]);
    expect(raw).not.toContain("HUMAN_AGENT");
    expect(raw).not.toContain("MESSAGE_TAG");
  });

  test("does not send tokens in payload", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.instagram.com/v25.0/${SENDER_ID}/messages`,
      200,
      { message_id: "ig-mid-111" },
    );

    await transport.send({
      recipient: RECIPIENT_ID,
      sender: SENDER_ID,
      credentialReference: CRED_REF,
      message: { type: "text", text: "hello" },
    });

    const raw = JSON.stringify(http.requests[0].body);
    const headers = JSON.stringify(http.requests[0].headers);
    expect(raw).not.toContain("IG_TOKEN_SENTINEL");
    expect(raw).not.toContain("ig-cred-ref");
    expect(headers).not.toContain("ig-cred-ref");
  });

  test("throws safe error on 401", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.instagram.com/v25.0/${SENDER_ID}/messages`,
      401,
      { error: { code: 190, message: "Access token expired" } },
    );

    await expect(
      transport.send({
        recipient: RECIPIENT_ID,
        sender: SENDER_ID,
        credentialReference: CRED_REF,
        message: { type: "text", text: "hello" },
      }),
    ).rejects.toThrow("META_INSTAGRAM_401");
  });

  test("classifies 5xx as retryable", async () => {
    const { http, transport } = buildTransport();
    http.setFixture(
      `https://graph.instagram.com/v25.0/${SENDER_ID}/messages`,
      503,
      { error: { code: 2, message: "Service temporarily unavailable" } },
    );

    try {
      await transport.send({
        recipient: RECIPIENT_ID,
        sender: SENDER_ID,
        credentialReference: CRED_REF,
        message: { type: "text", text: "hello" },
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.context.httpStatus).toBe(503);
      expect(error.context.retryable).toBe(true);
    }
  });
});
