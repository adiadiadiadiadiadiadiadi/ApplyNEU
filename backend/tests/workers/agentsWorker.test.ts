import { jest, describe, it, expect, beforeEach } from '@jest/globals';

class DelayedError extends Error {}
class UnrecoverableError extends Error {}
class Command {
    constructor(public args: { resume: unknown }) {}
}

let processor: (job: any, token?: string) => Promise<unknown>;
const handlers: Record<string, (...args: any[]) => Promise<void>> = {};

const runJobThread = jest.fn<(thread_id: string, input: any) => Promise<unknown>>();
const invoke = jest.fn<(input: unknown, config: any) => Promise<unknown>>();
const getState = jest.fn<(config: any) => Promise<any>>();
const getAgentRun = jest.fn<(run_id: string) => Promise<any>>();
const getAgentRunByThread = jest.fn<(thread_id: string) => Promise<any>>();
const claimAgentRun = jest.fn<(run_id: string, from: string[], opts?: any) => Promise<string>>();
const moveAgentRun = jest.fn<(run_id: string, from: string[], to: string) => Promise<boolean>>();

jest.unstable_mockModule('bullmq', () => ({
    DelayedError,
    UnrecoverableError,
    Worker: class {
        constructor(_name: string, fn: typeof processor) {
            processor = fn;
        }
        on(event: string, handler: (...args: any[]) => Promise<void>) {
            handlers[event] = handler;
        }
    },
}));
jest.unstable_mockModule('@langchain/langgraph', () => ({ Command }));
jest.unstable_mockModule('../../src/agents/jobGraph/graph.ts', () => ({ jobGraph: { invoke, getState }, runJobThread }));
jest.unstable_mockModule('../../src/queues/agentsQueue.ts', () => ({ AGENTS_QUEUE: 'agents' }));
jest.unstable_mockModule('../../src/queues/connection.ts', () => ({ bullConnection: {} }));
jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: { end: jest.fn() } }));
jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({
    claimAgentRun, getAgentRun, getAgentRunByThread, moveAgentRun,
}));
jest.unstable_mockModule('../../src/utils/shutdown.ts', () => ({ onShutdownSignal: jest.fn(), runShutdown: jest.fn() }));

await import('../../src/workers/agentsWorker.ts');

const RUN = { run_id: 'run-1', type: 'job', user_id: 'user-1', job_id: 'job-1', thread_id: 'thread-1' };
const moveToDelayed = jest.fn<(ts: number, token?: string) => Promise<void>>();
const startJob = (data: Record<string, unknown> = {}) => ({ name: 'start', id: 'start:run-1', data: { run_id: 'run-1', ...data }, moveToDelayed, attemptsMade: 0, opts: { attempts: 3 } });
const resumeJob = { name: 'resume', id: 'thread-1:approval', data: { thread_id: 'thread-1', value: { approved: true } }, moveToDelayed, attemptsMade: 0, opts: { attempts: 3 } };

beforeEach(() => {
    runJobThread.mockReset().mockResolvedValue({});
    invoke.mockReset().mockResolvedValue({});
    getState.mockReset().mockResolvedValue({ next: [] });
    getAgentRun.mockReset().mockResolvedValue(RUN);
    getAgentRunByThread.mockReset().mockResolvedValue({ ...RUN, status: 'waiting_for_you' });
    claimAgentRun.mockReset().mockResolvedValue('claimed');
    moveAgentRun.mockReset().mockResolvedValue(true);
    moveToDelayed.mockReset().mockResolvedValue();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('start', () => {
    it('claims a slot, runs the graph, and marks a finished thread done', async () => {
        await processor(startJob(), 'token');

        expect(claimAgentRun).toHaveBeenCalledWith('run-1', ['queued'], { force: undefined });
        expect(runJobThread).toHaveBeenCalledWith('thread-1', { user_id: 'user-1', job_id: 'job-1' });
        expect(moveAgentRun).toHaveBeenCalledWith('run-1', ['running'], 'done');
    });

    it('marks a thread stopped at an interrupt as waiting for the user', async () => {
        getState.mockResolvedValue({ next: ['awaitApproval'] });

        await processor(startJob(), 'token');

        expect(moveAgentRun).toHaveBeenCalledWith('run-1', ['running'], 'waiting_for_you');
    });

    it('passes run-now through as force', async () => {
        await processor(startJob({ force: true }), 'token');

        expect(claimAgentRun).toHaveBeenCalledWith('run-1', ['queued'], { force: true });
    });

    it('parks the job without running when the user has no free slot', async () => {
        claimAgentRun.mockResolvedValue('full');

        await expect(processor(startJob(), 'token')).rejects.toBeInstanceOf(DelayedError);
        expect(moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'token');
        expect(runJobThread).not.toHaveBeenCalled();
    });

    it('drops the job when the run was cancelled before it started', async () => {
        claimAgentRun.mockResolvedValue('gone');

        await processor(startJob(), 'token');

        expect(runJobThread).not.toHaveBeenCalled();
        expect(moveAgentRun).not.toHaveBeenCalled();
    });

    it('fails a run type that has no graph yet', async () => {
        getAgentRun.mockResolvedValue({ ...RUN, type: 'cover_letter' });

        await expect(processor(startJob(), 'token')).rejects.toBeInstanceOf(UnrecoverableError);
        expect(claimAgentRun).not.toHaveBeenCalled();
    });
});

describe('resume', () => {
    it('reclaims a slot from waiting and resumes the thread with the value', async () => {
        await processor(resumeJob, 'token');

        expect(getAgentRunByThread).toHaveBeenCalledWith('thread-1');
        expect(claimAgentRun).toHaveBeenCalledWith('run-1', ['waiting_for_you']);
        const [input, config] = invoke.mock.calls[0]!;
        expect((input as Command).args).toEqual({ resume: { approved: true } });
        expect(config).toEqual({ configurable: { thread_id: 'thread-1' } });
        expect(moveAgentRun).toHaveBeenCalledWith('run-1', ['running'], 'done');
    });

    it('drops a resume for a cancelled run', async () => {
        claimAgentRun.mockResolvedValue('gone');

        await processor(resumeJob, 'token');

        expect(invoke).not.toHaveBeenCalled();
    });

    it('rethrows a failed resume so BullMQ retries it', async () => {
        invoke.mockRejectedValue(new Error('checkpoint load failed'));

        await expect(processor(resumeJob, 'token')).rejects.toThrow('checkpoint load failed');
    });
});

describe('failed', () => {
    it('marks the run failed after the last attempt', async () => {
        await handlers.failed!({ ...startJob(), attemptsMade: 3 }, new Error('boom'));

        expect(moveAgentRun).toHaveBeenCalledWith('run-1', ['queued', 'running', 'waiting_for_you'], 'failed');
    });

    it('leaves the run alone while retries remain', async () => {
        await handlers.failed!({ ...startJob(), attemptsMade: 1 }, new Error('boom'));

        expect(moveAgentRun).not.toHaveBeenCalled();
    });

    it('marks it failed straight away on an unrecoverable error', async () => {
        await handlers.failed!({ ...startJob(), attemptsMade: 1 }, new UnrecoverableError('no graph'));

        expect(moveAgentRun).toHaveBeenCalledWith('run-1', ['queued', 'running', 'waiting_for_you'], 'failed');
    });
});
