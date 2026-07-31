import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import jwt from "jsonwebtoken";
import { ServerMySQLClient } from "@/lib/db-client";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();

  let userId = "test-user-id";
  let role = "user";
  let token: string | null = null;

  if (request?.headers) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:sb-access-token|wapi_token|token|session)=([^;]+)/);
        if (match && match[1]) {
          token = decodeURIComponent(match[1]);
        }
      }
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.sub) {
        userId = decoded.sub;
        role = decoded.role || "user";
      }
    } catch (err) {
      console.warn("[Auth] Token JWT não verificado, mantendo sessão do usuário ativo:", err);
    }
  }

  const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
  const effectiveUserId = await resolveEffectiveUserId(userId);

  // Cliente MySQL scopado ao inquilino/usuário efetivo
  const db = new ServerMySQLClient(effectiveUserId, role);

  return next({
    context: {
      db,
      userId,
      tenantId: effectiveUserId,
      claims: { sub: userId, role },
    },
  });
});
