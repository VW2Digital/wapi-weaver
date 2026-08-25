import { describe, expect, test } from "@jest/globals";
import { resolveInstagramChatOwnerId } from "../../src/lib/instagram-webhook-owner";

describe("resolveInstagramChatOwnerId", () => {
  test("persiste o chat no tenant mesmo quando a conta foi conectada por um membro", () => {
    expect(
      resolveInstagramChatOwnerId({ tenant_id: "tenant-1", user_id: "member-1" }),
    ).toBe("tenant-1");
  });

  test("mantém compatibilidade com contas antigas sem tenant_id", () => {
    expect(resolveInstagramChatOwnerId({ tenant_id: null, user_id: "owner-1" })).toBe("owner-1");
  });
});
