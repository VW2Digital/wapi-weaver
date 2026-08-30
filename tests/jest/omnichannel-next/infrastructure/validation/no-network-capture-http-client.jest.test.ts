import { describe, expect, test } from "@jest/globals";
import { NoNetworkCaptureHttpClient } from "@/lib/omnichannel-next/infrastructure/validation";
import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";

describe("NoNetworkCaptureHttpClient", () => {
  test("captures a WhatsApp Graph request without network", async () => {
    const client = new NoNetworkCaptureHttpClient();
    const response = await client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer REAL_TOKEN_VALUE",
      },
      body: { to: "15555551234", type: "text", text: { body: "OMNICHANNEL_NEXT_DRY_RUN" } },
    });

    expect(response.status).toBe(200);
    expect(client.networkAttempts).toBe(1);
    const captured = client.captured();
    expect(captured).not.toBeNull();
    expect(captured?.authorization).toBe("Bearer [REDACTED]");
    expect(captured?.host).toBe("graph.facebook.com");
    expect(captured?.senderNode).toBe("PHONE_123");
    expect(captured?.recipient).toBe("15555551234");
    expect(captured?.graphVersion).toBe("v25.0");
    expect(JSON.stringify(captured)).not.toContain("REAL_TOKEN_VALUE");
  });

  test("rejects non-WhatsApp endpoint", async () => {
    const client = new NoNetworkCaptureHttpClient();
    await expect(client.request({
      method: "POST",
      url: "https://other.example.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
    })).rejects.toMatchObject({ code: "DRY_RUN_ENDPOINT_INVALID" });
  });

  test("rejects missing Authorization", async () => {
    const client = new NoNetworkCaptureHttpClient();
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { "Content-Type": "application/json" },
      body: { to: "15555551234" },
    })).rejects.toMatchObject({ code: "DRY_RUN_AUTH_INVALID" });
  });

  test("rejects empty Bearer token", async () => {
    const client = new NoNetworkCaptureHttpClient();
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer " },
    })).rejects.toMatchObject({ code: "DRY_RUN_AUTH_EMPTY" });
  });
});
