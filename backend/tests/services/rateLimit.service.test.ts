import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

type ExecResult = [Error | null, unknown][] | null;

const exec = jest.fn<() => Promise<ExecResult>>();
const incr = jest.fn();
const expire = jest.fn();
const ttl = jest.fn();

const chain = { incr, expire, ttl, exec };
incr.mockReturnValue(chain);
expire.mockReturnValue(chain);
ttl.mockReturnValue(chain);

jest.unstable_mockModule('../../src/db/redis.ts', () => ({
    redis: { multi: () => chain },
}));

const { consumeModelCall } = await import('../../src/services/rateLimit/rateLimit.service.ts');

const USER_ID = 'user-1';

const replies = (minuteCount: number, minuteTtl: number, dayCount: number, dayTtl: number): ExecResult => [
    [null, minuteCount], [null, 1], [null, minuteTtl],
    [null, dayCount], [null, 1], [null, dayTtl],
];

const catchError = async (promise: Promise<unknown>) => {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    throw new Error('expected promise to reject');
};

describe('consumeModelCall', () => {
    let warn: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        exec.mockReset();
        incr.mockClear();
        expire.mockClear();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        delete process.env.JOB_MATCH_LIMIT_PER_MINUTE;
        delete process.env.JOB_MATCH_LIMIT_PER_DAY;
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('allows a call under both limits', async () => {
        exec.mockResolvedValue(replies(1, 60, 1, 86_400));
        await expect(consumeModelCall(USER_ID, 'job_match')).resolves.toBeUndefined();
    });

    it('counts per user and kind with expiring keys', async () => {
        exec.mockResolvedValue(replies(1, 60, 1, 86_400));
        await consumeModelCall(USER_ID, 'instructions');

        expect(incr).toHaveBeenCalledWith('ratelimit:instructions:user-1:minute');
        expect(incr).toHaveBeenCalledWith('ratelimit:instructions:user-1:day');
        expect(expire).toHaveBeenCalledWith('ratelimit:instructions:user-1:minute', 60, 'NX');
        expect(expire).toHaveBeenCalledWith('ratelimit:instructions:user-1:day', 86_400, 'NX');
    });

    it('allows the call that lands exactly on the limit', async () => {
        exec.mockResolvedValue(replies(20, 30, 200, 3600));
        await expect(consumeModelCall(USER_ID, 'job_match')).resolves.toBeUndefined();
    });

    it('throws 429 with the minute TTL when over the per-minute limit', async () => {
        exec.mockResolvedValue(replies(21, 38, 50, 3600));
        const error = await catchError(consumeModelCall(USER_ID, 'job_match'));

        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).status).toBe(429);
        expect((error as AppError).retryAfter).toBe(38);
    });

    it('throws 429 with the day TTL when over the per-day limit', async () => {
        exec.mockResolvedValue(replies(3, 38, 201, 32_400));
        const error = await catchError(consumeModelCall(USER_ID, 'job_match'));

        expect((error as AppError).status).toBe(429);
        expect((error as AppError).retryAfter).toBe(32_400);
    });

    it('uses lower default limits for instructions', async () => {
        exec.mockResolvedValue(replies(11, 20, 11, 3600));
        const error = await catchError(consumeModelCall(USER_ID, 'instructions'));

        expect((error as AppError).status).toBe(429);
    });

    it('reads limits from env', async () => {
        process.env.JOB_MATCH_LIMIT_PER_MINUTE = '2';
        exec.mockResolvedValue(replies(3, 10, 3, 3600));
        const error = await catchError(consumeModelCall(USER_ID, 'job_match'));

        expect((error as AppError).retryAfter).toBe(10);
    });

    it('fails open and warns when redis is unavailable', async () => {
        exec.mockRejectedValue(new Error('Connection is closed.'));

        await expect(consumeModelCall(USER_ID, 'job_match')).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });

    it('fails open and warns when a command inside the transaction errors', async () => {
        exec.mockResolvedValue([
            [new Error('WRONGTYPE'), null], [null, 1], [null, 60],
            [null, 1], [null, 1], [null, 86_400],
        ]);

        await expect(consumeModelCall(USER_ID, 'job_match')).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});
