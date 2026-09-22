import { describe, expect, it, jest } from "@jest/globals";
import { updateInstagramMediaSelectionForTenant } from "../../src/lib/instagram-public-content.functions";

describe("Instagram Public Content tenant isolation", () => {
  it("always scopes a media mutation by media ID and tenant ID", async () => {
    const execute = jest
      .fn<(sql: string, params: unknown[]) => Promise<{ affectedRows?: number }>>()
      .mockResolvedValue({ affectedRows: 0 });

    const result = await updateInstagramMediaSelectionForTenant(execute, {
      tenantId: "tenant-b",
      mediaId: "media-owned-by-tenant-a",
      selected: true,
      rightsConfirmed: true,
    });

    expect(result.affectedRows).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain("WHERE id = ? AND tenant_id = ?");
    expect(params).toEqual([1, 1, "media-owned-by-tenant-a", "tenant-b"]);
  });
});
