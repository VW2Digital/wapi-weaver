import path from "path";
import { verifyApiUser, type AuthenticatedUser } from "./subscription-helpers";
import { getActorTenantAccess } from "./tenant-authorization";

export async function verifyStorageUser(request: Request): Promise<AuthenticatedUser> {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${queryToken}`);
    try {
      return await verifyApiUser(new Request(request, { headers }));
    } catch (e) {
      // Ignore query token error and fallback to standard request headers
    }
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:sb-access-token|wapi_token|token|app-token|session)=([^;]+)/);
      if (match && match[1]) {
        const token = decodeURIComponent(match[1]);
        const headers = new Headers(request.headers);
        headers.set("Authorization", `Bearer ${token}`);
        try {
          return await verifyApiUser(new Request(request, { headers }));
        } catch (e) {
          // Fallback to default verifyApiUser
        }
      }
    }
  }

  return verifyApiUser(request);
}

function normalizeStoragePath(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new Error("Invalid path");
  const withoutUploads = input
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/?uploads\//, "");
  const normalized = path.posix.normalize(withoutUploads).replace(/^\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error("Invalid path");
  }
  return normalized;
}

export async function tenantUploadPath(requestedPath: unknown, user: AuthenticatedUser) {
  const normalized = normalizeStoragePath(requestedPath);
  if (normalized === user.tenantId || normalized.startsWith(`${user.tenantId}/`)) return normalized;
  return `${user.tenantId}/${normalized}`;
}

export async function assertTenantStoragePath(requestedPath: unknown, user: AuthenticatedUser) {
  const normalized = normalizeStoragePath(requestedPath);
  const access = await getActorTenantAccess(user.userId, user.tenantId);
  if (
    !access.isMaster &&
    normalized !== user.tenantId &&
    !normalized.startsWith(`${user.tenantId}/`)
  ) {
    throw Object.assign(new Error("File not found or access denied"), { statusCode: 403 });
  }
  return normalized;
}

export function resolveUploadFilePath(uploadsRoot: string, tenantPath: string): string {
  const fullPath = path.resolve(uploadsRoot, tenantPath);
  if (!fullPath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error("Invalid path");
  return fullPath;
}
