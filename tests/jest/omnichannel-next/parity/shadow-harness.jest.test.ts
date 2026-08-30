import { describe, expect, test } from "@jest/globals";
import { currentWhatsAppContract, currentInstagramContract, nextWhatsAppContract, nextInstagramContract } from "./contract-normalizer";
import { compareContracts } from "./contract-diff";

describe("Shadow harness", () => {
  test("does not use real credentials in descriptors", () => {
    const wa = currentWhatsAppContract();
    const ig = currentInstagramContract();
    const all = JSON.stringify([wa, ig]);
    expect(all).not.toContain("EAAA");
    expect(all).not.toMatch(/Bearer [A-Za-z0-9]/);
    expect(all).not.toMatch(/\d{10,}/);
  });

  test("provenance is documented for every contract", () => {
    expect(currentWhatsAppContract().provenance).toBe("STATIC_SOURCE_AUDIT");
    expect(currentInstagramContract().provenance).toBe("STATIC_SOURCE_AUDIT");
  });

  test("compares WA and IG without real network", async () => {
    const waNext = await nextWhatsAppContract();
    const igNext = await nextInstagramContract();

    expect(waNext.provenance).toBe("EXECUTED_MOCK");
    expect(igNext.provenance).toBe("EXECUTED_MOCK");

    const waResult = compareContracts(currentWhatsAppContract(), waNext);
    const igResult = compareContracts(currentInstagramContract(), igNext);

    expect(waResult.overall).toBe("INTENTIONAL_IMPROVEMENT");
    expect(igResult.overall).toBe("API_VARIANT_DIFFERENCE");
  });
});
