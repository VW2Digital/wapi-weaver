import { describe, expect, it, jest } from "@jest/globals";
import { ProviderDispatcher } from "../../../src/lib/messaging/outbound/provider-dispatcher";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../../../src/lib/messaging/outbound/types";

function mockAdapter(result: OutboundSendResult, throwOnSend = false): IOutboundAdapter {
  return {
    provider: result.provider,
    send: jest.fn(async () => {
      if (throwOnSend) throw new Error(`${result.provider} send failed`);
      return result;
    }),
  } as unknown as IOutboundAdapter;
}

describe("ProviderDispatcher failure isolation", () => {
  it("continues to resolve Instagram after WhatsApp failure", async () => {
    const registry = {
      get: (provider: string) => {
        if (provider === "whatsapp") return mockAdapter({ provider: "whatsapp" } as OutboundSendResult, true);
        if (provider === "instagram") return mockAdapter({ provider: "instagram", providerMessageId: "ig-123" } as OutboundSendResult);
        throw new Error("unknown provider");
      },
    };
    const dispatcher = new ProviderDispatcher(registry);

    await expect(
      dispatcher.dispatch({
        tenantId: "t1",
        userId: "u1",
        messageId: "m1",
        provider: "whatsapp",
        contactPhone: "+1",
        payload: { type: "text" },
        metadata: null,
      } as OutboundMessageContext),
    ).rejects.toThrow("whatsapp send failed");

    const result = await dispatcher.dispatch({
      tenantId: "t1",
      userId: "u1",
      messageId: "m2",
      provider: "instagram",
      contactPhone: "+1",
      payload: { type: "text" },
      metadata: null,
    } as OutboundMessageContext);

    expect(result.provider).toBe("instagram");
    expect(result.providerMessageId).toBe("ig-123");
  });

  it("continues to resolve WhatsApp after Instagram failure", async () => {
    const registry = {
      get: (provider: string) => {
        if (provider === "instagram") return mockAdapter({ provider: "instagram" } as OutboundSendResult, true);
        if (provider === "whatsapp") return mockAdapter({ provider: "whatsapp", providerMessageId: "wa-123" } as OutboundSendResult);
        throw new Error("unknown provider");
      },
    };
    const dispatcher = new ProviderDispatcher(registry);

    await expect(
      dispatcher.dispatch({
        tenantId: "t1",
        userId: "u1",
        messageId: "m1",
        provider: "instagram",
        contactPhone: "+1",
        payload: { type: "text" },
        metadata: null,
      } as OutboundMessageContext),
    ).rejects.toThrow("instagram send failed");

    const result = await dispatcher.dispatch({
      tenantId: "t1",
      userId: "u1",
      messageId: "m2",
      provider: "whatsapp",
      contactPhone: "+1",
      payload: { type: "text" },
      metadata: null,
    } as OutboundMessageContext);

    expect(result.provider).toBe("whatsapp");
    expect(result.providerMessageId).toBe("wa-123");
  });
});
