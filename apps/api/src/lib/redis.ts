// ioredis v5 type exports can conflict with TypeScript's class/namespace resolution.
// We use `any` here to avoid import type issues, with explicit safety checks at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Redis: any;

try {
  Redis = require('ioredis').default || require('ioredis');
} catch {
  console.warn('⚠️  ioredis not available — caching disabled');
}

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
