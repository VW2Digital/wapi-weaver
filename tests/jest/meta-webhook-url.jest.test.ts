import { describe, expect, test } from "@jest/globals";
import { resolvePublicWebhookBaseUrl } from "../../src/lib/meta-webhook-url";

describe("resolvePublicWebhookBaseUrl", () => {
  test("prioriza o domínio público sobre APP_URL local", () => {
    expect(
      resolvePublicWebhookBaseUrl({
        PUBLIC_APP_URL: "https://app.blivcrm.com",
        APP_URL: "http://localhost:8080",
      }),
    ).toBe("https://app.blivcrm.com/");
  });

  test.each([
    "http://localhost:8080",
    "https://127.0.0.1:3000",
    "http://app.blivcrm.com",
    "valor-invalido",
  ])("recusa callback inacessível ou inseguro: %s", (APP_URL) => {
    expect(resolvePublicWebhookBaseUrl({ APP_URL })).toBeNull();
  });
});
