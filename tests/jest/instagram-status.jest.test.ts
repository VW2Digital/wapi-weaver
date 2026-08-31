/// <reference types="jest" />
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";

describe("Instagram message status — messaging_seen", () => {
  it("produces a message.status event for messaging_seen", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1_700_000_000,
          messaging: [
            {
              sender: { id: "10869300000000000" },
              recipient: { id: "17841400000000000" },
              timestamp: 1_700_000_001,
              read: {
                mid: "m.InstagramMessageId",
              },
            },
          ],
        },
      ],
    };

    const result = instagramAdapter.normalize(payload);

    expect(result.diagnostics?.ignoredCount ?? 0).toBe(0);
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.provider).toBe("instagram");
    expect(event.eventType).toBe("message.status");
    expect(event.payload).toMatchObject({
      providerMessageId: "m.InstagramMessageId",
      status: "read",
      providerTimestamp: 1_700_000_001,
    });
  });

  it("does not create a message.received for messaging_seen", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1_700_000_000,
          messaging: [
            {
              sender: { id: "10869300000000000" },
              recipient: { id: "17841400000000000" },
              timestamp: 1_700_000_001,
              read: {
                mid: "m.InstagramMessageId",
              },
            },
          ],
        },
      ],
    };

    const result = instagramAdapter.normalize(payload);

    const received = result.events.filter((e) => e.eventType === "message.received");
    expect(received).toHaveLength(0);
  });

  it("ignores read events without mid", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1_700_000_000,
          messaging: [
            {
              sender: { id: "10869300000000000" },
              recipient: { id: "17841400000000000" },
              timestamp: 1_700_000_001,
              read: {},
            },
          ],
        },
      ],
    };

    const result = instagramAdapter.normalize(payload);

    expect(result.events).toHaveLength(0);
    expect(result.diagnostics?.ignoredCount ?? 0).toBe(1);
  });

  it("still produces a regular message.received for customer text", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1_700_000_000,
          messaging: [
            {
              sender: { id: "10869300000000000" },
              recipient: { id: "17841400000000000" },
              timestamp: 1_700_000_001,
              message: {
                mid: "m.CustomerMessageId",
                text: "Oi",
              },
            },
          ],
        },
      ],
    };

    const result = instagramAdapter.normalize(payload);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("message.received");
  });
});
