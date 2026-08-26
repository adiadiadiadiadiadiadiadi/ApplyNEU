import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  lazyConnect: process.env.NODE_ENV === 'test',
});

redis.on('connect', () => {
  console.log('connected to redis');
});

let loggedError = false;
redis.on('error', (err: Error) => {
  // Log once per outage instead of on every reconnect attempt.
  if (!loggedError) {
    console.error('redis error (caching disabled until reconnect):', err.message);
    loggedError = true;
  }
});

redis.on('ready', () => {
  loggedError = false;
});
