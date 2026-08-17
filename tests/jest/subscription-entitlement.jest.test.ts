import { describe, expect, it } from "@jest/globals";
import { resolveCombinedEntitlement } from "@/lib/subscription-entitlement";

const now = new Date("2026-08-17T12:00:00.000Z");

describe("resolveCombinedEntitlement", () => {
  it("usa a vigência maior quando a licença administrativa foi prorrogada", () => {
    const result = resolveCombinedEntitlement(
      { status: "active", expires_at: "2026-12-31T23:59:59.000Z" },
      { status: "expiring", expires_at: "2026-08-19T20:42:39.000Z" },
      now,
    );
    expect(result.allowed).toBe(true);
    expect(result.status).toBe("active");
    expect(result.effectiveEnd?.toISOString()).toBe("2026-12-31T23:59:59.000Z");
  });

  it("aceita a assinatura paga quando a licença espelho ficou vencida", () => {
    const result = resolveCombinedEntitlement(
      { status: "active", expires_at: "2026-08-09T23:59:59.000Z" },
      { status: "active", expires_at: "2026-09-17T23:59:59.000Z" },
      now,
    );
    expect(result.allowed).toBe(true);
    expect(result.effectiveEnd?.toISOString()).toBe("2026-09-17T23:59:59.000Z");
  });

  it("preserva bloqueio administrativo explícito", () => {
    const result = resolveCombinedEntitlement(
      { status: "blocked", expires_at: "2026-12-31T23:59:59.000Z" },
      { status: "active", expires_at: "2026-12-31T23:59:59.000Z" },
      now,
    );
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("suspended");
  });

  it("mantém acesso durante o período de tolerância", () => {
    const result = resolveCombinedEntitlement(
      null,
      {
        status: "past_due",
        expires_at: "2026-08-16T12:00:00.000Z",
        grace_period_ends_at: "2026-08-19T12:00:00.000Z",
      },
      now,
    );
    expect(result.allowed).toBe(true);
    expect(result.status).toBe("past_due");
  });
});
