import { describe, expect, test } from "@jest/globals";
import { currentInstagramContract, nextInstagramContract } from "./contract-normalizer";
import { compareContracts } from "./contract-diff";

describe("Instagram contract parity", () => {
  test("current and next are API variant different", async () => {
    const current = currentInstagramContract();
    const next = await nextInstagramContract();
    const result = compareContracts(current, next);

    expect(result.overall).toBe("API_VARIANT_DIFFERENCE");
    expect(result.risk).toBe("HIGH");

    const hostDiff = result.differences.find((d) => d.field === "host");
    expect(hostDiff?.classification).toBe("API_VARIANT_DIFFERENCE");
    expect(hostDiff?.risk).toBe("HIGH");

    const bodyDiff = result.differences.find((d) => d.field === "normalizedBody");
    expect(bodyDiff?.classification).toBe("API_VARIANT_DIFFERENCE");
    expect(bodyDiff?.risk).toBe("HIGH");

    const humanAgentTest = JSON.stringify(current.normalizedBody);
    expect(humanAgentTest).not.toContain("HUMAN_AGENT");
    expect(humanAgentTest).not.toContain("MESSAGE_TAG");
  });
});
