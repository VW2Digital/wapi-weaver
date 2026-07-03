import Redis from "ioredis";

// Centralized Redis client instance
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || "redis_pass",
    maxRetriesPerRequest: null, // Required by BullMQ
    enableOfflineQueue: false, // Prevents hanging operations if Redis is unavailable
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Get or set a cached value from Redis.
 *
 * @param key Redis cache key
 * @param fetcher Function to fetch the value if it's not in cache
 * @param ttlSeconds Time-to-live in seconds (default: 15 minutes)
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 900,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    console.error(`[Cache] Error reading key ${key}:`, error);
  }

  // Value not found or error reading, execute fetcher
  const value = await fetcher();

  // Don't cache null or undefined
  if (value != null) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      console.error(`[Cache] Error writing key ${key}:`, error);
    }
  }

  return value;
}
