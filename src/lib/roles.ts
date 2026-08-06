export type UserRole = "admin_master" | "admin" | "user";

export function isAdminMaster(role: unknown): role is "admin_master" {
  return role === "admin_master" || role === "adminmaster";
}

export function isMaster(role: unknown): boolean {
  return role === "admin_master" || role === "adminmaster";
}

export function isAdmin(role: unknown): role is "admin" {
  return role === "admin" || role === "owner";
}

export function isCompanyAdmin(role: unknown): boolean {
  return role === "admin" || role === "owner";
}

export function isUser(role: unknown): role is "user" {
  return role === "user";
}

export function isMember(role: unknown): boolean {
  return role === "user" || role === "member";
}

export function hasMasterRole(roles: readonly unknown[]): boolean {
  return roles.some((r) => r === "admin_master" || r === "adminmaster");
}

export function hasCompanyAdminRole(roles: readonly unknown[]): boolean {
  return roles.some((r) => r === "admin" || r === "owner");
}

export function canManageUsers(roles: readonly unknown[]): boolean {
  return hasMasterRole(roles) || hasCompanyAdminRole(roles);
}

export function canManageTenantSettings(roles: readonly unknown[]): boolean {
  return hasCompanyAdminRole(roles);
}

export function canAccessMasterPanel(roles: readonly unknown[]): boolean {
  return hasMasterRole(roles);
}

export function canAccessTenant(
  authenticatedUserRole: UserRole | string,
  userTenantId: string,
  requestedTenantId: string,
): boolean {
  if (authenticatedUserRole === "admin_master") {
    return true;
  }
  return userTenantId === requestedTenantId;
}
