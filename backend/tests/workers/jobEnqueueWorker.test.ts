import { jest, describe, it, expect, beforeEach } from '@jest/globals';

let processor: (job: any) => Promise<unknown>;
const handlers: Record<string, (...args: any[]) => unknown> = {};
const invoke = jest.fn<(input: unknown, config: any) => Promise<unknown>>();

class Command {
    constructor(public args: { resume: unknown }) {}
}

jest.unstable_mockModule('bullmq', () => ({
    Worker: class {
        constructor(_name: string, fn: typeof processor) {
            processor = fn;
        }
        on(event: string, handler: (...args: any[]) => unknown) {
            handlers[event] = handler;
        }
    },
}));
jest.unstable_mockModule('@langchain/langgraph', () => ({ Command }));
jest.unstable_mockModule('../../src/agents/jobGraph/graph.ts', () => ({ jobGraph: { invoke } }));
jest.unstable_mockModule('../../src/queues/connection.ts', () => ({ bullConnection: {} }));
jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: { end: jest.fn() } }));
jest.unstable_mockModule('../../src/utils/shutdown.ts', () => ({ onShutdownSignal: jest.fn(), runShutdown: jest.fn() }));

await import('../../src/workers/jobEnqueueWorker.ts');

const job = { id: 'thread-1:approval', data: { thread_id: 'thread-1', value: { approved: true } } };

beforeEach(() => {
    invoke.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('jobEnqueueWorker', () => {
    it('resumes the thread with the enqueued value', async () => {
        await processor(job);

        const [input, config] = invoke.mock.calls[0]!;
        expect(input).toBeInstanceOf(Command);
        expect((input as Command).args).toEqual({ resume: { approved: true } });
        expect(config).toEqual({ configurable: { thread_id: 'thread-1' } });
    });

    it('rethrows so BullMQ retries a failed resume', async () => {
        invoke.mockRejectedValue(new Error('checkpoint load failed'));

        await expect(processor(job)).rejects.toThrow('checkpoint load failed');
    });
});
