import fs from "node:fs";
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
      return await verifyApiUser(new Request(request.url, { method: request.method, headers }));
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
          return await verifyApiUser(new Request(request.url, { method: request.method, headers }));
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
  const isBareFileName = !normalized.includes("/");
  if (
    !access.isMaster &&
    !isBareFileName &&
    normalized !== user.tenantId &&
    !normalized.startsWith(`${user.tenantId}/`) &&
    normalized !== user.userId &&
    !normalized.startsWith(`${user.userId}/`)
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

function walkFindFile(dir: string, fileName: string, uploadsRoot: string, depth: number): string | null {
  if (depth > 5 || !fs.existsSync(dir)) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (!full.startsWith(`${uploadsRoot}${path.sep}`)) continue;
    if (entry.isFile() && entry.name === fileName) return full;
    if (entry.isDirectory()) {
      const nested = walkFindFile(full, fileName, uploadsRoot, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function resolveExistingUploadFile(
  uploadsRoot: string,
  requestedPath: string,
  user: AuthenticatedUser,
): string | null {
  const candidates = [requestedPath];
  if (!requestedPath.startsWith(`${user.tenantId}/`)) {
    candidates.push(`${user.tenantId}/${requestedPath}`);
  }
  if (user.userId !== user.tenantId && !requestedPath.startsWith(`${user.userId}/`)) {
    candidates.push(`${user.userId}/${requestedPath}`);
  }
  for (const candidate of candidates) {
    try {
      const full = resolveUploadFilePath(uploadsRoot, candidate);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    } catch {
      // skip invalid candidate
    }
  }
  const base = path.posix.basename(requestedPath);
  if (!base || base === "." || base.includes("..")) return null;
  const searchRoots = [user.tenantId, user.userId].filter(Boolean);
  for (const rootName of searchRoots) {
    try {
      const root = resolveUploadFilePath(uploadsRoot, rootName);
      const found = walkFindFile(root, base, uploadsRoot, 0);
      if (found) return found;
    } catch {
      // skip
    }
  }
  return null;
}
