import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_NAVIGATION_ORDER,
  getOrderedNavigationItems,
  isCompleteNavigationOrder,
  isNavigationVisible,
  moveNavigationItem,
  NAVIGATION_REGISTRY,
  normalizeNavigationOrder,
  resolveNavigationRoute,
} from "../../src/lib/navigation-registry";

describe("global navigation registry", () => {
  it("moves items without duplicating or removing stable IDs", () => {
    const custom = moveNavigationItem(DEFAULT_NAVIGATION_ORDER, 2, "up");
    expect(custom[1]).toBe(DEFAULT_NAVIGATION_ORDER[2]);
    expect(custom[2]).toBe(DEFAULT_NAVIGATION_ORDER[1]);
    expect(new Set(custom)).toEqual(new Set(DEFAULT_NAVIGATION_ORDER));
    expect(custom).toHaveLength(DEFAULT_NAVIGATION_ORDER.length);
  });

  it("ignores invalid boundary movements", () => {
    expect(moveNavigationItem(DEFAULT_NAVIGATION_ORDER, 0, "up")).toEqual(
      DEFAULT_NAVIGATION_ORDER,
    );
    expect(
      moveNavigationItem(DEFAULT_NAVIGATION_ORDER, DEFAULT_NAVIGATION_ORDER.length - 1, "down"),
    ).toEqual(DEFAULT_NAVIGATION_ORDER);
  });

  it("migrates the legacy route-based order to stable IDs", () => {
    const order = normalizeNavigationOrder([
      "/settings",
      "/contacts",
      "/dashboard",
      "/not-a-route",
      "/settings",
    ]);
    expect(order.slice(0, 3)).toEqual(["settings", "contacts", "dashboard"]);
    expect(order).toHaveLength(DEFAULT_NAVIGATION_ORDER.length);
  });

  it("appends newly registered items to an older persisted order", () => {
    const oldOrder = DEFAULT_NAVIGATION_ORDER.slice(0, -1);
    expect(normalizeNavigationOrder(oldOrder)).toEqual(DEFAULT_NAVIGATION_ORDER);
  });

  it("requires a complete unique order before persistence", () => {
    expect(isCompleteNavigationOrder([...DEFAULT_NAVIGATION_ORDER])).toBe(true);
    expect(isCompleteNavigationOrder(DEFAULT_NAVIGATION_ORDER.slice(1))).toBe(false);
    expect(
      isCompleteNavigationOrder([
        ...DEFAULT_NAVIGATION_ORDER.slice(0, -1),
        DEFAULT_NAVIGATION_ORDER[0],
      ]),
    ).toBe(false);
  });

  it("preserves access restrictions independently from ordering", () => {
    expect(isNavigationVisible("all", { isAdmin: false, isMaster: false })).toBe(true);
    expect(isNavigationVisible("admin", { isAdmin: false, isMaster: false })).toBe(false);
    expect(isNavigationVisible("admin", { isAdmin: true, isMaster: false })).toBe(true);
    expect(isNavigationVisible("master", { isAdmin: true, isMaster: false })).toBe(false);
    expect(isNavigationVisible("master", { isAdmin: true, isMaster: true })).toBe(true);
  });

  it("uses the persisted order when rendering definitions", () => {
    const custom = moveNavigationItem(DEFAULT_NAVIGATION_ORDER, 1, "down");
    expect(getOrderedNavigationItems(custom).map(({ id }) => id)).toEqual(custom);
  });

  it("resolves Instagram Content and every registered menu destination", () => {
    expect(resolveNavigationRoute("/instagram-content")).toBe("/instagram-content");
    for (const item of NAVIGATION_REGISTRY) {
      expect(resolveNavigationRoute(item.to)).not.toBeNull();
      for (const child of item.children || []) {
        expect(resolveNavigationRoute(child.to)).not.toBeNull();
      }
    }
  });

  it("rejects unknown routes instead of redirecting to settings", () => {
    expect(resolveNavigationRoute("/unknown-sidebar-route")).toBeNull();
  });
});
