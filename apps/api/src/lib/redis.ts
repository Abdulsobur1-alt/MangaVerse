// Static ESM import (matches the pattern used in queues/scraper.ts).
// Note: a runtime `require()` here would be undefined under "type": "module",
// silently disabling the cache in the compiled production build.
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: ReturnType<typeof createRedisClient> = null;

function createRedisClient() {
  if (!Redis) return null;
  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err: Error) => {
      console.warn('⚠️  Redis connection error (caching disabled):', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    return client;
  } catch {
    console.warn('⚠️  Redis not available — caching disabled');
    return null;
  }
}

redisClient = createRedisClient();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 900,
): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch {
    // silently fail
  }
}

/** True when Redis is actually reachable (used by the admin health check). */
export async function redisHealthy(): Promise<boolean> {
  if (!redisClient) return false;
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
