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

  it("permite acesso quando a licença está ativa, sem consultar uma assinatura antiga", async () => {
    resolveEffectiveUserIdMock.mockResolvedValue("tenant-1");
    queryMock.mockResolvedValueOnce([
      {
        status: "active",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        plan: "basic",
        plan_name: "Básico",
        plan_code: "basic",
      },
    ]);

    const access = await getTenantSubscriptionAccess("user-1");

    expect(access.allowed).toBe(true);
    expect(access.status).toBe("active");
    expect(access.reason).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
