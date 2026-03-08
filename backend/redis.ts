import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Lightweight, single shared client. Swallow errors so Redis outages don't break the app.
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
});

export const safeGet = async (key: string): Promise<string | null> => {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
};

export const safeSet = async (key: string, value: string, ttlSeconds: number) => {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch {
    /* ignore */
  }
};

export const safeDel = async (key: string) => {
  try {
    await redis.del(key);
  } catch {
    /* ignore */
  }
};

