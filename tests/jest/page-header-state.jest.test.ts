import { describe, expect, it } from "@jest/globals";
import {
  clearPageHeaderIfOwner,
  dropHeaderIfPathChanged,
  resolveVisibleHeader,
} from "../../src/components/layout/page-header-state";

const dashboard = {
  ownerId: "dashboard",
  pathname: "/dashboard",
  title: "Dashboard",
};

const instagram = {
  ownerId: "instagram",
  pathname: "/instagram-content",
  title: "Conteúdo público do Instagram",
};

describe("page header ownership", () => {
  it("hides a previous page header as soon as the pathname changes", () => {
    expect(resolveVisibleHeader(dashboard, "/chat")).toBeNull();
    expect(dropHeaderIfPathChanged(dashboard, "/chat")).toBeNull();
  });

  it("keeps the header that belongs to the current route", () => {
    expect(resolveVisibleHeader(instagram, "/instagram-content")).toEqual(instagram);
  });

  it("does not let a previous page cleanup erase the next page header", () => {
    const afterNav = dashboard;
    expect(clearPageHeaderIfOwner(afterNav, "instagram")).toEqual(dashboard);
    expect(clearPageHeaderIfOwner(afterNav, "dashboard")).toBeNull();
  });

  it("shows no global header when the route never registered one", () => {
    expect(resolveVisibleHeader(null, "/chat")).toBeNull();
    expect(resolveVisibleHeader({ ownerId: "bot", pathname: "/bot" }, "/bot")).toBeNull();
  });
});
