import Anthropic from '@anthropic-ai/sdk';

const BACKOFF_DELAYS = [500, 1000, 2000];

const isTransientError = (error: unknown): boolean =>
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError;

export const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let i = 0; i <= BACKOFF_DELAYS.length; i++) {
        try {
            return await fn();
        } catch (error) {
            if (!isTransientError(error)) throw error;
            lastError = error;
            if (i < BACKOFF_DELAYS.length) {
                await new Promise(resolve => setTimeout(resolve, BACKOFF_DELAYS[i]));
            }
        }
    }
    throw lastError;
};
