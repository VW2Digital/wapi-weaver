"use server";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import jwt from "jsonwebtoken";
import { ServerMySQLClient } from "@/lib/db-client";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();

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

  if (!token) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  if (!decoded?.sub) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  const userId = decoded.sub;
  let role = decoded.role || "user";

  const { default: rawDb } = await import("@/lib/db");
  const liveRoles = (await rawDb.query(
    "SELECT role FROM user_roles WHERE user_id = ? ORDER BY FIELD(role, 'admin_master', 'admin', 'user') ASC LIMIT 1",
    [userId],
  )) as any[];
  if (liveRoles && liveRoles.length > 0) {
    role = liveRoles[0].role;
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

export const requireSubscription = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const { getTenantSubscriptionAccess } = await import("@/lib/services/subscription-access.service");
    const access = await getTenantSubscriptionAccess(context.userId);

    if (!access.allowed) {
      throw Object.assign(
        new Error("SUBSCRIPTION_REQUIRED: Seu período de teste de 3 dias terminou. Ative sua assinatura para continuar."),
        {
          statusCode: 402,
          code: "SUBSCRIPTION_REQUIRED",
          access,
        }
      );
    }

    return next({
      context: {
        ...context,
        subscriptionAccess: access,
      },
    });
  });
