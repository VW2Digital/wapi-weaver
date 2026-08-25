import { describe, expect, test } from "@jest/globals";
import { resolveInstagramRecordOwnership } from "../../src/lib/instagram-webhook-owner";

describe("resolveInstagramRecordOwnership", () => {
  test("mantém tenant e usuário conector separados", () => {
    expect(
      resolveInstagramRecordOwnership({ tenant_id: "tenant-1", user_id: "member-1" }),
    ).toEqual({ tenantId: "tenant-1", userId: "member-1" });
  });

  test("mantém compatibilidade com contas antigas sem tenant_id", () => {
    expect(resolveInstagramRecordOwnership({ tenant_id: null, user_id: "owner-1" })).toEqual({
      tenantId: "owner-1",
      userId: "owner-1",
    });
  });
});
