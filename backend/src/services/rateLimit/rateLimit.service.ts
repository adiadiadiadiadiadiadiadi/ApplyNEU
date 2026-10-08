import { redis } from '../../db/redis.ts';
import { AppError } from '../../errors/AppError.ts';

export type ModelCallKind = 'job_match' | 'instructions';

const WINDOWS = { minute: 60, day: 86_400 };

const DEFAULTS: Record<ModelCallKind, { minute: number; day: number }> = {
  job_match: { minute: 20, day: 200 },
  instructions: { minute: 10, day: 100 },
};

const limitsFor = (kind: ModelCallKind) => {
  const prefix = kind.toUpperCase();
  return {
    minute: Number(process.env[`${prefix}_LIMIT_PER_MINUTE`] ?? DEFAULTS[kind].minute),
    day: Number(process.env[`${prefix}_LIMIT_PER_DAY`] ?? DEFAULTS[kind].day),
  };
};

/**
 * Counts one model call against the user's per-minute and per-day limits for this kind.
 * Fails open (allows the call) when Redis is unavailable.
 * @param userId - User making the model call
 * @param kind - Which model call is being charged
 * @throws AppError(429) with retryAfter (seconds) when either limit is exceeded
 */
export const consumeModelCall = async (userId: string, kind: ModelCallKind) => {
  const limits = limitsFor(kind);
  const minuteKey = `ratelimit:${kind}:${userId}:minute`;
  const dayKey = `ratelimit:${kind}:${userId}:day`;

  let results;
  try {
    results = await redis.multi()
      .incr(minuteKey).expire(minuteKey, WINDOWS.minute, 'NX').ttl(minuteKey)
      .incr(dayKey).expire(dayKey, WINDOWS.day, 'NX').ttl(dayKey)
      .exec();
  } catch (error) {
    console.warn('[rateLimit] redis unavailable, allowing model call:', error);
    return;
  }

  if (!results || results.some(([err]) => err)) {
    console.warn('[rateLimit] redis command failed, allowing model call');
    return;
  }

  const [minuteCount, , minuteTtl, dayCount, , dayTtl] = results.map(([, value]) => value) as
    [number, number, number, number, number, number];

  if (minuteCount > limits.minute) throw new AppError(429, 'Too many requests.', minuteTtl);
  if (dayCount > limits.day) throw new AppError(429, 'Daily limit reached.', dayTtl);
};
