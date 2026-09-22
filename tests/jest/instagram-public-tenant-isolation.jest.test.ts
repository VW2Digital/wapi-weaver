import { describe, expect, it, jest } from "@jest/globals";
import {
  findReusableInstagramConnectionForTenant,
  type ReusableInstagramConnectionRow,
  updateInstagramMediaSelectionForTenant,
} from "../../src/lib/instagram-public-content.functions";

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

  it("only resolves a reusable Direct connection inside the authenticated tenant", async () => {
    const execute = jest
      .fn<
        (
          sql: string,
          params: unknown[],
        ) => Promise<ReusableInstagramConnectionRow[]>
      >()
      .mockResolvedValue([]);

    const result = await findReusableInstagramConnectionForTenant(
      execute,
      "tenant-b",
    );

    expect(result).toBeNull();
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toContain("WHERE ia.tenant_id = ?");
    expect(sql).toContain("cc.tenant_id = ia.tenant_id");
    expect(sql).toContain("cc.provider = 'instagram'");
    expect(params).toEqual(["tenant-b"]);
  });
});
