import { createMiddleware } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import jwt from "jsonwebtoken";
import { getOrCreateSubscription, calculateSubscriptionStatus } from "./subscription-helpers";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

/**
 * React Start middleware that enforces an active subscription.
 * Throws "subscription_required" if the subscription is suspended or cancelled.
 */
export const requireActiveSubscription = createMiddleware({ type: "function" })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    const sub = await getOrCreateSubscription(context.tenantId, context.userId);
    const realStatus = calculateSubscriptionStatus(sub);

    if (realStatus === "suspended" || realStatus === "cancelled") {
      throw new Error("subscription_required");
    }

    return next({
      context: {
        ...context,
        subscription: sub,
        subscriptionStatus: realStatus,
      },
    });
  });

/**
 * Checks a request's subscription status.
 * Used for intercepting API routes at the HTTP gateway level (e.g. server.ts).
 */
export async function checkRequestSubscription(request: Request): Promise<{ active: boolean; error?: string }> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { active: true }; // Let auth middleware block if unauthorized
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.sub) {
      return { active: true };
    }

    const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
    const tenantId = await resolveEffectiveUserId(decoded.sub);

    const sub = await getOrCreateSubscription(tenantId, decoded.sub);
    const status = calculateSubscriptionStatus(sub);

    if (status === "suspended" || status === "cancelled") {
      return { active: false, error: "subscription_required" };
    }

    return { active: true };
  } catch (e) {
    return { active: true }; // Fallback to allow if token is invalid or parsing fails (let auth handle it)
  }
}
