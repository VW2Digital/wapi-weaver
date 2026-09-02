import { afterEach, describe, expect, jest, test } from "@jest/globals";
import dns from "dns";
import {
  validateSafeUrlForSSRF,
  executeHttpRequest,
  resolveTemplate,
} from "@/lib/botflow-control";
import { buildWhatsAppBotMessage } from "@/lib/meta-whatsapp-message";

const minimalCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    tenantId: "tenant-1",
    userId: "user-1",
    contact: { phone: "+5511999999999" },
    message: {},
    channel: "whatsapp",
    variables: overrides as Record<string, unknown>,
  } as any);

function mockFetch() {
  return jest.fn() as any;
}

function mockLookup(publicIp = "1.1.1.1") {
  return jest
    .spyOn(dns.promises, "lookup")
    .mockResolvedValue([{ address: publicIp, family: 4 }] as any);
}

describe("P0-A SSRF / HTTP Security", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("validateSafeUrlForSSRF", () => {
    test("rejects localhost, 0.0.0.0 and metadata hostnames", async () => {
      await expect(validateSafeUrlForSSRF("http://localhost/admin")).rejects.toThrow();
      await expect(validateSafeUrlForSSRF("http://0.0.0.0/admin")).rejects.toThrow();
      await expect(validateSafeUrlForSSRF("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
      await expect(validateSafeUrlForSSRF("http://metadata.google.internal/")).rejects.toThrow();
    });

    test("rejects non-HTTP(S) protocols", async () => {
      await expect(validateSafeUrlForSSRF("file:///etc/passwd")).rejects.toThrow();
      await expect(validateSafeUrlForSSRF("ftp://1.1.1.1/")).rejects.toThrow();
    });

    test("rejects hostnames that resolve to private IP ranges", async () => {
      mockLookup("10.0.0.1");
      await expect(validateSafeUrlForSSRF("http://myserver.example.com/")).rejects.toThrow();
    });

    test("rejects unspecified and multicast resolved addresses", async () => {
      mockLookup("0.0.0.0");
      await expect(validateSafeUrlForSSRF("http://public.example/")).rejects.toThrow(/reservida|restrita/i);
      mockLookup("224.0.0.1");
      await expect(validateSafeUrlForSSRF("http://public.example/")).rejects.toThrow(/reservida|restrita/i);
    });

    test("accepts public endpoints with public IPs", async () => {
      mockLookup("1.1.1.1");
      const safe = await validateSafeUrlForSSRF("https://api.public.example.com/webhook");
      expect(safe).toMatch(/^https:\/\//);
    });
  });

  describe("executeHttpRequest", () => {
    test("does not follow redirects without re-validating", async () => {
      const fetchMock = mockFetch();
      fetchMock.mockResolvedValueOnce({
        status: 302,
        headers: { get: (k: string) => (k.toLowerCase() === "location" ? "http://169.254.169.254/" : null) },
        body: { getReader: undefined },
      });
      global.fetch = fetchMock;

      mockLookup("1.1.1.1");

      const res = await executeHttpRequest(
        { method: "GET", url: "https://public.example.com/" },
        minimalCtx(),
      );
      expect(res.success).toBe(false);
      expect(res.error ?? "").toMatch(/169\.254\.169\.254|restrita|proibido/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("strips CRLF and null from headers", async () => {
      const fetchMock = mockFetch();
      fetchMock.mockResolvedValue({
        status: 200,
        headers: { get: () => "" },
        arrayBuffer: async () => new ArrayBuffer(0),
      });
      global.fetch = fetchMock;

      mockLookup("1.1.1.1");

      const res = await executeHttpRequest(
        {
          method: "POST",
          url: "https://public.example.com/",
          headers: [{ key: "X-Test", value: "before\r\nX-Injected: 1\0after" }],
        },
        minimalCtx(),
      );
      expect(res.success).toBe(true);
      const [_, options] = fetchMock.mock.calls[0] as [string, any];
      expect(options.headers["X-Test"]).toBe("beforeX-Injected: 1after");
    });

    test("rejects invalid JSON body after template resolution", async () => {
      const fetchMock = mockFetch();
      global.fetch = fetchMock;

      mockLookup("1.1.1.1");

      const res = await executeHttpRequest(
        {
          method: "POST",
          url: "https://public.example.com/",
          bodyType: "json",
          body: '{"x": "{{payload}}"}',
        },
        minimalCtx({ payload: 'value"}' }),
      );
      expect(res.success).toBe(false);
    });

    test("caps response body at 1MB", async () => {
      const fetchMock = mockFetch();
      const chunk = new Uint8Array(1024 * 1024 + 1);
      const reader = { read: (jest.fn() as any).mockResolvedValueOnce({ done: false, value: chunk }) };
      fetchMock.mockResolvedValue({
        status: 200,
        headers: { get: () => "" },
        body: { getReader: () => reader },
      });
      global.fetch = fetchMock;

      mockLookup("1.1.1.1");

      const res = await executeHttpRequest(
        { method: "GET", url: "https://public.example.com/" },
        minimalCtx(),
      );
      expect(res.success).toBe(false);
      expect(res.error ?? "").toMatch(/1MB/);
    });
  });
});

describe("P0-A WhatsApp CTA URL validation", () => {
  test("rejects private and non-HTTPS CTA URLs", () => {
    const badUrls = [
      "http://example.com",
      "https://127.0.0.1/",
      "https://0.0.0.0/",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.1/",
      "https://192.168.0.1/",
    ];
    for (const url of badUrls) {
      const res = buildWhatsAppBotMessage("123", {
        message_type: "cta_url",
        message_content: "cta body",
        buttons_config: { action: { parameters: { url, display_text: "Open" } } },
      });
      expect(res.ok).toBe(false);
    }
  });

  test("accepts public HTTPS CTA URL", () => {
    const res = buildWhatsAppBotMessage("123", {
      message_type: "cta_url",
      message_content: "cta body",
      buttons_config: { action: { parameters: { url: "https://example.com/", display_text: "Open" } } },
    });
    expect(res.ok).toBe(true);
  });
});

describe("P0-A template injection mitigation", () => {
  test("resolveTemplate returns plain text, not executable code", () => {
    const ctx = minimalCtx({ input: 'a" + alert(1)' });
    const out = resolveTemplate("{{input}}", ctx);
    expect(out).toBe('a" + alert(1)');
    expect(out).not.toMatch(/<script>/);
  });
});
