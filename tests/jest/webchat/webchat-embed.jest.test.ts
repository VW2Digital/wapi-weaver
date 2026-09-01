import { describe, expect, test } from "@jest/globals";
import { getWebchatAppUrl, getWebchatEmbedCode } from "@/lib/webchat/embed";

describe("WebChat Embed", () => {
  test("returns embed code with public id and app url", () => {
    const appUrl = "https://app.blivcrm.com";
    const publicId = "abc-123";
    const code = getWebchatEmbedCode({ appUrl, publicId });

    expect(code).toContain(publicId);
    expect(code).toContain("https://app.blivcrm.com/api/public/webchat/abc-123/widget.js");
    expect(code).toContain("<script");
    expect(code).toContain("async");
    expect(code).toContain("</script>");
  });

  test("strips trailing slash from app url", () => {
    const code = getWebchatEmbedCode({ appUrl: "https://app.blivcrm.com/", publicId: "x" });
    expect(code).toContain("https://app.blivcrm.com/api/public/webchat/x/widget.js");
  });

  test.each([
    ["tenant_id", "tenant-123"],
    ["channel_connection_id", "channel-123"],
    ["sessionToken", "token-xyz"],
    ["Meta token", "meta-token"],
    ["encryption key", "enc-key"],
  ])("does not expose %s in the embed code", (_label, secret) => {
    const code = getWebchatEmbedCode({ appUrl: "https://app.blivcrm.com", publicId: "widget-1" });
    expect(code).not.toContain(secret);
  });

  test("produces distinct scripts for distinct widgets", () => {
    const a = getWebchatEmbedCode({ appUrl: "https://app.blivcrm.com", publicId: "AAA" });
    const b = getWebchatEmbedCode({ appUrl: "https://app.blivcrm.com", publicId: "BBB" });

    expect(a).toContain("AAA");
    expect(b).toContain("BBB");
    expect(a).not.toContain("BBB");
    expect(b).not.toContain("AAA");
  });

  test("getWebchatAppUrl prefers PUBLIC_APP_URL", () => {
    const original = { public: process.env.PUBLIC_APP_URL, app: process.env.APP_URL };
    process.env.PUBLIC_APP_URL = "https://public.example.com/";
    process.env.APP_URL = "https://app.example.com";

    expect(getWebchatAppUrl()).toBe("https://public.example.com");

    process.env.PUBLIC_APP_URL = original.public;
    process.env.APP_URL = original.app;
  });

  test("getWebchatAppUrl falls back to APP_URL", () => {
    const original = { public: process.env.PUBLIC_APP_URL, app: process.env.APP_URL };
    process.env.PUBLIC_APP_URL = "";
    process.env.APP_URL = "https://fallback.example.com";

    expect(getWebchatAppUrl()).toBe("https://fallback.example.com");

    process.env.PUBLIC_APP_URL = original.public;
    process.env.APP_URL = original.app;
  });
});
