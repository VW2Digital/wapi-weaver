import { describe, expect, test } from "@jest/globals";
import { currentWhatsAppContract, nextWhatsAppContract, currentInstagramContract, nextInstagramContract } from "./contract-normalizer";
import { compareContracts } from "./contract-diff";

describe("Cross-provider contract isolation", () => {
  test("WA parity does not depend on IG parity", async () => {
    const current = currentWhatsAppContract();
    const next = await nextWhatsAppContract();
    const result = compareContracts(current, next);

    expect(result.overall).toBe("INTENTIONAL_IMPROVEMENT");
  });

  test("IG parity does not depend on WA parity", async () => {
    const current = currentInstagramContract();
    const next = await nextInstagramContract();
    const result = compareContracts(current, next);

    expect(result.overall).toBe("API_VARIANT_DIFFERENCE");
    expect(result.risk).toBe("HIGH");
  });

  test("WA comparison and IG comparison can run in parallel", async () => {
    const [wa, ig] = await Promise.all([
      nextWhatsAppContract().then((next) => compareContracts(currentWhatsAppContract(), next)),
      nextInstagramContract().then((next) => compareContracts(currentInstagramContract(), next)),
    ]);

    expect(wa.overall).toBe("INTENTIONAL_IMPROVEMENT");
    expect(ig.overall).toBe("API_VARIANT_DIFFERENCE");
  });
});
