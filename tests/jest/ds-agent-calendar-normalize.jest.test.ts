import { describe, expect, it } from "@jest/globals";
import {
  normalizeCalendarDateTime,
  normalizeCalendarDateOnly,
  getAmericaSaoPauloNow,
} from "@/lib/ds-agent-tools.server";

describe("getAmericaSaoPauloNow", () => {
  it("returns the Sao Paulo calendar year for a known instant", () => {
    const clock = getAmericaSaoPauloNow(new Date("2026-09-11T12:36:00-03:00"));
    expect(clock.year).toBe(2026);
    expect(clock.isoDate).toBe("2026-09-11");
    expect(clock.datePtBr).toBe("11/09/2026");
    expect(clock.clockLine).toContain("2026");
    expect(clock.clockLine).not.toContain("2023");
  });
});

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
