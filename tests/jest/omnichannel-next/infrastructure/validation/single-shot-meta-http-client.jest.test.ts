import { describe, expect, test, jest, beforeEach, afterEach } from "@jest/globals";
import { SingleShotMetaHttpClient } from "@/lib/omnichannel-next/infrastructure/validation";
import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";

describe("SingleShotMetaHttpClient", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.SINGLE" }] }),
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("allows one request and captures meta result", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    const response = await client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer REAL_TOKEN_VALUE",
      },
      body: { to: "15555551234", type: "text", text: { body: "BLIV CRM test" } },
    });

    expect(response.status).toBe(200);
    expect(client.networkAttempts).toBe(1);
    expect(client.sentRequests).toBe(1);
    const result = client.result();
    expect(result?.metaAccepted).toBe(true);
    expect(result?.providerMessageId).toBe("wamid.SINGLE");
    const captured = client.captured();
    expect(captured?.authorization).toBe("Bearer [REDACTED]");
    expect(captured?.senderNode).toBe("[MASKED]");
    expect(captured?.recipient).toContain("**1234");
    expect(JSON.stringify(captured)).not.toContain("REAL_TOKEN_VALUE");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("blocks second request before network", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    await client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    });

    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_BLOCKED" });

    expect(client.networkAttempts).toBe(2);
    expect(client.sentRequests).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("rejects non-allowlisted host", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    await expect(client.request({
      method: "POST",
      url: "https://other.example.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_HOST_INVALID" });
    expect(client.sentRequests).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("rejects invalid path", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/different",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_PATH_INVALID" });
    expect(client.sentRequests).toBe(0);
  });

  test("rejects sender mismatch", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/OTHER_456/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_SENDER_MISMATCH" });
    expect(client.sentRequests).toBe(0);
  });

  test("rejects recipient mismatch", async () => {
    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "16666666666", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_RECIPIENT_MISMATCH" });
    expect(client.sentRequests).toBe(0);
  });

  test("no retry on 400", async () => {
    fetchSpy.mockResolvedValueOnce({
      status: 400,
      json: async () => ({ error: { code: 100, message: "Invalid" } }),
    } as Response);

    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    const response = await client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    });

    expect(response.status).toBe(400);
    expect(client.result()?.metaAccepted).toBe(false);
    expect(client.result()?.metaErrorCode).toBe(100);
    expect(client.sentRequests).toBe(1);
  });

  test("no retry on 429", async () => {
    fetchSpy.mockResolvedValueOnce({
      status: 429,
      json: async () => ({ error: { code: 80008, message: "Rate limit" } }),
    } as Response);

    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234");
    const response = await client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    });

    expect(response.status).toBe(429);
    expect(client.result()?.metaAccepted).toBe(false);
    expect(client.sentRequests).toBe(1);
  });

  test("timeout fails without retry", async () => {
    fetchSpy.mockImplementationOnce(() => new Promise((_, reject) => {
      const error = new Error("The operation was aborted");
      (error as Error & { name: string }).name = "AbortError";
      setTimeout(() => reject(error), 10);
    }));

    const client = new SingleShotMetaHttpClient("PHONE_123", "v25.0", "15555551234", 5);
    await expect(client.request({
      method: "POST",
      url: "https://graph.facebook.com/v25.0/PHONE_123/messages",
      headers: { Authorization: "Bearer token" },
      body: { to: "15555551234", type: "text" },
    })).rejects.toMatchObject({ code: "SINGLE_SHOT_TIMEOUT" });
    expect(client.sentRequests).toBe(1);
    expect(client.result()).toBeNull();
  });
});
