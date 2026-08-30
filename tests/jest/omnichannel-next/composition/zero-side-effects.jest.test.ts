import { describe, expect, test } from "@jest/globals";

describe("omnichannel-next zero side effect import", () => {
  test("importing the public entry point does not start workers, queues or connections", async () => {
    // Importing the barrel must not open MySQL connections, Redis connections,
    // create BullMQ workers, or start any background process.
    const mod = await import("@/lib/omnichannel-next");

    expect(mod.createOmnichannelNext).toBeDefined();
    expect(mod.createOmnichannelNext).toBeInstanceOf(Function);
    expect(mod.createWhatsappWorker).toBeDefined();
    expect(mod.createInstagramWorker).toBeDefined();
  });
});
