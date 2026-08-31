"use server";

import { redis } from "@/lib/cache";

const SESSION_MAX = 10;
const MESSAGE_MAX = 60;
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
): Promise<boolean> {
  const ip = getClientIp(request);
  const sessionKey = `webchat:rate:msg:session:${sessionId}`;
  const ipKey = `webchat:rate:msg:ip:${ip}`;
  const [sessionOk, ipOk] = await Promise.all([
    checkLimit(sessionKey, MESSAGE_MAX),
    checkLimit(ipKey, MESSAGE_MAX),
  ]);
  return sessionOk && ipOk;
}
