/// <reference types="jest" />
import { providerRegistry } from "@/lib/messaging/outbound/provider-registry";
import { providerDispatcher } from "@/lib/messaging/outbound/provider-dispatcher";
import { UnsupportedProviderError } from "@/lib/messaging/outbound/types";

describe("Outbound Provider Registry", () => {
  it("resolves whatsapp adapter", () => {
    const adapter = providerRegistry.get("whatsapp");
    expect(adapter.provider).toBe("whatsapp");
  });

  it("resolves instagram adapter", () => {
    const adapter = providerRegistry.get("instagram");
    expect(adapter.provider).toBe("instagram");
  });

  it("resolves messenger adapter", () => {
    const adapter = providerRegistry.get("messenger");
    expect(adapter.provider).toBe("messenger");
  });

  it("throws for unknown provider", () => {
    expect(() => providerRegistry.get("telegram" as any)).toThrow(UnsupportedProviderError);
  });
});

describe("Outbound Provider Dispatcher", () => {
  it("does not fall back to whatsapp for unknown provider", async () => {
    await expect(
      providerDispatcher.dispatch({
        tenantId: "t1",
        userId: "u1",
        messageId: "m1",
        provider: "telegram" as any,
        contactPhone: "+1",
        type: "text",
        payload: { type: "text" },
        metadata: null,
      }),
    ).rejects.toThrow(UnsupportedProviderError);
  });
});
