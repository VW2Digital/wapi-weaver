export type UserRole = "adminmaster" | "owner" | "org_admin" | "member" | "user" | "admin";

export function isMaster(role: unknown): role is "adminmaster" {
  return role === "adminmaster";
}

export function isCompanyAdmin(role: unknown): role is "owner" {
  return role === "owner";
}

export function isMember(role: unknown): role is "member" | "user" {
  return role === "member" || role === "user";
}

export function hasMasterRole(roles: readonly unknown[]): boolean {
  return roles.some(isMaster);
}

export function hasCompanyAdminRole(roles: readonly unknown[]): boolean {
  return roles.some(isCompanyAdmin);
}
