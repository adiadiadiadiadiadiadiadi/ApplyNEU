import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

const create = jest.fn<(args: any) => Promise<any>>();
const addTask = jest.fn<(...args: any[]) => Promise<any>>();
const consumeModelCall = jest.fn<(userId: string, kind: string) => Promise<void>>();

jest.unstable_mockModule('../../src/services/rateLimit/rateLimit.service.ts', () => ({
    consumeModelCall,
}));

jest.unstable_mockModule('../../src/services/task/task.service.ts', () => ({
    addTask,
}));

class TransientError extends Error {}

jest.unstable_mockModule('@anthropic-ai/sdk', () => {
    class Anthropic {
        messages = { create };
        static APIConnectionError = TransientError;
        static RateLimitError = TransientError;
        static InternalServerError = TransientError;
    }
    return { default: Anthropic };
});

const { addInstructions } = await import('../../src/services/task/ai.task.service.ts');

const USER_ID = 'user-1';
const APPLICATION_ID = 'app-1';

const modelReply = (employer_instructions: unknown[]) => ({
    content: [{ type: 'text', text: JSON.stringify({ employer_instructions }) }],
});

beforeEach(() => {
    create.mockReset();
    addTask.mockReset();
    consumeModelCall.mockReset();
    consumeModelCall.mockResolvedValue(undefined);
});

describe('addInstructions rate limit', () => {
    it('charges an instructions call before calling the model', async () => {
        create.mockResolvedValue(modelReply([]));

        await addInstructions(USER_ID, 'Complete the assessment.', APPLICATION_ID);

        expect(consumeModelCall).toHaveBeenCalledWith(USER_ID, 'instructions');
        expect(consumeModelCall.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]!);
    });

    it('propagates a 429 with retryAfter and skips the model', async () => {
        consumeModelCall.mockRejectedValue(new AppError(429, 'Daily limit reached.', 3600));

        await expect(addInstructions(USER_ID, 'Complete the assessment.', APPLICATION_ID))
            .rejects.toMatchObject({ status: 429, retryAfter: 3600 });
        expect(create).not.toHaveBeenCalled();
        expect(addTask).not.toHaveBeenCalled();
    });
});
