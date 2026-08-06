import { describe, expect, it } from "@jest/globals";
import {
  hasCompanyAdminRole,
  hasMasterRole,
  isCompanyAdmin,
  isMaster,
  isMember,
} from "../../src/lib/roles";

describe("role mapping", () => {
  it("grants platform master privileges only to adminmaster", () => {
    expect(isMaster("adminmaster")).toBe(true);
    expect(hasMasterRole(["adminmaster"])).toBe(true);

    for (const role of ["owner", "org_admin", "admin", "member", "user"]) {
      expect(isMaster(role)).toBe(false);
      expect(hasMasterRole([role])).toBe(false);
    }
  });

  it("grants company administrator privileges only to owner", () => {
    expect(isCompanyAdmin("owner")).toBe(true);
    expect(hasCompanyAdminRole(["owner"])).toBe(true);

    for (const role of ["adminmaster", "org_admin", "admin", "member", "user"]) {
      expect(isCompanyAdmin(role)).toBe(false);
      expect(hasCompanyAdminRole([role])).toBe(false);
    }
  });

  it("maps member and user to operational members", () => {
    expect(isMember("member")).toBe(true);
    expect(isMember("user")).toBe(true);
    expect(isMember("owner")).toBe(false);
  });
});
