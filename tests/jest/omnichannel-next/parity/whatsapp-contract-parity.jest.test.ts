import { describe, expect, test } from "@jest/globals";
import { currentWhatsAppContract, nextWhatsAppContract } from "./contract-normalizer";
import { compareContracts } from "./contract-diff";

describe("WhatsApp contract parity", () => {
  test("current and next text contracts are structurally compatible", async () => {
    const current = currentWhatsAppContract();
    const next = await nextWhatsAppContract();
    const result = compareContracts(current, next);

    expect(result.overall).toBe("INTENTIONAL_IMPROVEMENT");
    expect(result.risk).toBe("LOW");

    const nonMatches = result.differences.filter((d) => d.classification !== "MATCH");
    expect(nonMatches).toHaveLength(2);

    const versionDiff = result.differences.find((d) => d.field === "graphVersionSource");
    expect(versionDiff?.classification).toBe("EXPECTED_ARCHITECTURAL_DIFFERENCE");
    expect(versionDiff?.risk).toBe("LOW");

    const statusDiff = result.differences.find((d) => d.field === "successSemantics");
    expect(statusDiff?.classification).toBe("INTENTIONAL_IMPROVEMENT");
    expect(statusDiff?.risk).toBe("LOW");

    expect(result.differences.some((d) => d.field === "normalizedBody" && d.classification === "MATCH")).toBe(true);
    expect(result.differences.some((d) => d.field === "method" && d.classification === "MATCH")).toBe(true);
    expect(result.differences.some((d) => d.field === "host" && d.classification === "MATCH")).toBe(true);
    expect(result.differences.some((d) => d.field === "senderNodeType" && d.classification === "MATCH")).toBe(true);
    expect(result.differences.some((d) => d.field === "recipientType" && d.classification === "MATCH")).toBe(true);
    expect(result.differences.some((d) => d.field === "responseMessageIdPath" && d.classification === "MATCH")).toBe(true);
  });
});
