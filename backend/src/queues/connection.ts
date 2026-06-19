// src/queues/connection.ts
// Single source of truth for the BullMQ Redis connection.
// Mirrors the cache client (db/redis.ts), which connects via REDIS_URL, so the
// queue, worker, and cache all point at the same Redis in every environment.
import type { RedisOptions } from 'ioredis';

function buildConnection(): RedisOptions {
    // BullMQ requires maxRetriesPerRequest: null on connections it uses —
    // workers issue blocking commands and BullMQ manages retries itself.
    const base: RedisOptions = { maxRetriesPerRequest: null };

    const url = process.env.REDIS_URL;
    if (url) {
        const parsed = new URL(url);
        return {
            ...base,
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            // redis:// = plaintext, rediss:// = TLS (managed providers use the latter).
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
        };
    }

    // Local/dev fallback when REDIS_URL is unset.
    return {
        ...base,
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
    };
}

export const bullConnection: RedisOptions = buildConnection();
