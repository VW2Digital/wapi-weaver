import { describe, expect, it } from "@jest/globals";
import { DEFAULT_NAVIGATION_ORDER } from "../../src/lib/navigation-registry";
import {
  persistGlobalSidebarOrder,
  readGlobalSidebarOrder,
  SidebarOrderConflictError,
} from "../../src/lib/sidebar-order.repository";

describe("sidebar order repository", () => {
  it("reads and normalizes a legacy persisted order", async () => {
    const rows = [
      {
        sidebar_order: JSON.stringify({
          version: 4,
          order: ["/settings", "/dashboard"],
        }),
        updated_at: "2026-09-22T12:00:00.000Z",
      },
    ];
    const query = async <T,>() => rows as T;

    const snapshot = await readGlobalSidebarOrder(query);
    expect(snapshot.order.slice(0, 2)).toEqual(["settings", "dashboard"]);
    expect(snapshot.order).toHaveLength(DEFAULT_NAVIGATION_ORDER.length);
    expect(snapshot.version).toBe(4);
  });

  it("persists the complete order atomically with optimistic versioning", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];
    let callCount = 0;
    const query = async <T,>(sql: string, params?: unknown[]) => {
      callCount += 1;
      if (callCount === 1) {
        return [
          {
            sidebar_order: JSON.stringify({
              version: 7,
              order: DEFAULT_NAVIGATION_ORDER,
            }),
          },
        ] as T;
      }
      capturedSql = sql;
      capturedParams = params || [];
      return { affectedRows: 1 } as T;
    };
    const custom = [
      DEFAULT_NAVIGATION_ORDER[1],
      DEFAULT_NAVIGATION_ORDER[0],
      ...DEFAULT_NAVIGATION_ORDER.slice(2),
    ];

    const saved = await persistGlobalSidebarOrder(query, {
      order: custom,
      expectedVersion: 7,
      updatedBy: "admin-id",
    });

    expect(saved.order).toEqual(custom);
    expect(saved.version).toBe(8);
    expect(capturedSql).toContain("WHERE id = 1 AND sidebar_order <=> ?");
    expect(capturedParams[0]).toBe(JSON.stringify({ version: 8, order: custom }));
    expect(capturedParams[1]).toBe("admin-id");
  });

  it("rejects a stale administrator version without overwriting", async () => {
    const query = async <T,>() =>
      [
        {
          sidebar_order: JSON.stringify({
            version: 3,
            order: DEFAULT_NAVIGATION_ORDER,
          }),
        },
      ] as T;

    await expect(
      persistGlobalSidebarOrder(query, {
        order: [...DEFAULT_NAVIGATION_ORDER],
        expectedVersion: 2,
        updatedBy: "stale-admin",
      }),
    ).rejects.toBeInstanceOf(SidebarOrderConflictError);
  });

  it("propagates database failures", async () => {
    const query = async <T,>(): Promise<T> => {
      throw new Error("database unavailable");
    };
    await expect(
      persistGlobalSidebarOrder(query, {
        order: [...DEFAULT_NAVIGATION_ORDER],
        expectedVersion: 1,
        updatedBy: "admin-id",
      }),
    ).rejects.toThrow("database unavailable");
  });
});
