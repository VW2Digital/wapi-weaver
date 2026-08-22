import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const queryMock = jest.fn<(...args: any[]) => Promise<any>>();
const resolveEffectiveUserIdMock = jest.fn<(userId: string) => Promise<string>>();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: queryMock },
}));

jest.mock("@/lib/subscription-helpers", () => ({
  verifyApiUser: jest.fn(),
}));

jest.mock("@/lib/chat-helpers", () => ({
  resolveEffectiveUserId: resolveEffectiveUserIdMock,
}));

import { getTenantSubscriptionAccess } from "@/lib/services/subscription-access.service";

describe("getTenantSubscriptionAccess", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resolveEffectiveUserIdMock.mockReset();
  });

  it("permite acesso quando licença e assinatura possuem a mesma vigência", async () => {
    resolveEffectiveUserIdMock.mockResolvedValue("tenant-1");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce([
      {
        id: "license-1",
        status: "active",
        expires_at: expiresAt,
        plan: "basic",
        plan_name: "Básico",
        plan_code: "basic",
      },
    ]);
    queryMock.mockResolvedValueOnce([
      {
        id: "subscription-1",
        status: "active",
        expires_at: expiresAt,
        current_period_end: expiresAt,
        plan_id: "basic",
      },
    ]);

    const access = await getTenantSubscriptionAccess("user-1");

    expect(access.allowed).toBe(true);
    expect(access.status).toBe("active");
    expect(access.reason).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("reconcilia a assinatura quando a licença possui vigência maior", async () => {
    resolveEffectiveUserIdMock.mockResolvedValue("tenant-1");
    const licenseEnd = new Date("2026-12-31T23:59:59.000Z");
    const subscriptionEnd = new Date("2026-08-19T23:59:59.000Z");
    queryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "license-1",
        status: "active",
        expires_at: licenseEnd,
        plan: "enterprise",
      }])
      .mockResolvedValueOnce([{
        id: "subscription-1",
        status: "expiring",
        expires_at: subscriptionEnd,
        current_period_end: null,
        plan_id: "enterprise",
      }])
      .mockResolvedValueOnce([]);

    const access = await getTenantSubscriptionAccess("user-1");

    expect(access.allowed).toBe(true);
    expect(access.currentPeriodEnd).toBe(licenseEnd.toISOString());
    expect(queryMock).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("SET status = 'active', expires_at = ?, current_period_end = ?"),
      [licenseEnd, licenseEnd, "subscription-1"],
    );
  });

  it("não escreve no banco quando a consulta é somente leitura", async () => {
    resolveEffectiveUserIdMock.mockResolvedValue("tenant-1");
    const licenseEnd = new Date("2026-12-31T23:59:59.000Z");
    const subscriptionEnd = new Date("2026-08-19T23:59:59.000Z");
    queryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "license-1",
        status: "active",
        expires_at: licenseEnd,
        plan: "enterprise",
      }])
      .mockResolvedValueOnce([{
        id: "subscription-1",
        status: "expiring",
        expires_at: subscriptionEnd,
        current_period_end: null,
        plan_id: "enterprise",
      }]);

    const access = await getTenantSubscriptionAccess("user-1", { reconcile: false });

    expect(access.allowed).toBe(true);
    expect(access.currentPeriodEnd).toBe(licenseEnd.toISOString());
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
});
