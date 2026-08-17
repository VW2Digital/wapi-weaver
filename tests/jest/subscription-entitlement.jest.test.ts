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

  it.each([
    ["no vencimento", "2026-08-17T12:00:00.000Z"],
    ["dois dias após o vencimento", "2026-08-19T12:00:00.000Z"],
  ])("mantém somente o aviso %s mesmo sem grace_period_ends_at", (_label, currentTime) => {
    const result = resolveCombinedEntitlement(
      { status: "active", expires_at: "2026-08-17T12:00:00.000Z" },
      { status: "active", current_period_end: "2026-08-17T12:00:00.000Z" },
      new Date(currentTime),
    );

    expect(result.allowed).toBe(true);
    expect(result.status).toBe("past_due");
    expect(result.reason).toBe("grace_period");
  });

  it("bloqueia no terceiro dia após o vencimento", () => {
    const result = resolveCombinedEntitlement(
      { status: "active", expires_at: "2026-08-17T12:00:00.000Z" },
      { status: "active", current_period_end: "2026-08-17T12:00:00.000Z" },
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("expired");
  });

  it("inicia a tolerância pela maior data de renovação entre as duas tabelas", () => {
    const result = resolveCombinedEntitlement(
      { status: "active", expires_at: "2026-08-18T12:00:00.000Z" },
      { status: "active", current_period_end: "2026-08-17T12:00:00.000Z" },
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(result.allowed).toBe(true);
    expect(result.status).toBe("past_due");
  });
});
