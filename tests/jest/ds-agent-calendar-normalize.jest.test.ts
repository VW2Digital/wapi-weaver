import { describe, expect, it } from "@jest/globals";
import { normalizeCalendarDateTime, normalizeCalendarDateOnly } from "@/lib/ds-agent-tools.server";

describe("normalizeCalendarDateTime", () => {
  it("bumps past years to current year", () => {
    const out = normalizeCalendarDateTime("2023-09-10 15:30:00");
    expect(out.startsWith("2026-09-10") || out.startsWith("2027-09-10")).toBe(true);
    expect(out).toMatch(/15:30:00$/);
  });

  it("normalizes date-only", () => {
    const out = normalizeCalendarDateOnly("2023-09-10");
    expect(out === "2026-09-10" || out === "2027-09-10").toBe(true);
  });
});
