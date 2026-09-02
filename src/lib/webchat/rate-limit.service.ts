"use server";

import { redis } from "@/lib/cache";

const SESSION_MAX = 10;
const MESSAGE_MAX = 60;
// Status ACKs are batched and cheap, but a widget can legitimately emit them
// more often than messages (delivered on poll + read on visibility).
const STATUS_MAX = 120;
const WINDOW_SECONDS = 60;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function checkLimit(key: string, max: number): Promise<boolean> {
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    return current <= max;
  } catch (err) {
    // If Redis is unavailable, fail open for runtime safety but log.
    console.warn("[WebChat Rate Limit] Redis unavailable, allowing request", err);
    return true;
  }
}

export async function checkSessionCreationRateLimit(
  publicId: string,
  request: Request,
): Promise<boolean> {
  const ip = getClientIp(request);
  const key = `webchat:rate:session:${publicId}:${ip}`;
  return checkLimit(key, SESSION_MAX);
}

export async function checkMessageRateLimit(
  sessionId: string,
  request: Request,
  publicId?: string,
): Promise<boolean> {
  const ip = getClientIp(request);
  const sessionKey = `webchat:rate:msg:session:${sessionId}`;
  // The IP bucket is scoped by widget so that traffic against one tenant's
  // widget can never consume another tenant's quota.
  const ipKey = publicId
    ? `webchat:rate:msg:ip:${publicId}:${ip}`
    : `webchat:rate:msg:ip:${ip}`;
  const [sessionOk, ipOk] = await Promise.all([
    checkLimit(sessionKey, MESSAGE_MAX),
    checkLimit(ipKey, MESSAGE_MAX),
  ]);
  return sessionOk && ipOk;
}

export async function checkStatusAckRateLimit(
  publicId: string,
  sessionId: string,
): Promise<boolean> {
  // Scoped by widget + session: no cross-tenant and no cross-session interference.
  const key = `webchat:rate:status:${publicId}:${sessionId}`;
  return checkLimit(key, STATUS_MAX);
}
