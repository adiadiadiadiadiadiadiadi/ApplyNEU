import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

const add = jest.fn<(name: string, data: unknown, opts: any) => Promise<unknown>>();
const remove = jest.fn<(id: string) => Promise<number>>();
const createAgentRun = jest.fn<(run: any) => Promise<any>>();
const cancelAgentRun = jest.fn<(run_id: string, user_id: string) => Promise<any>>();

jest.unstable_mockModule('../../src/queues/agentsQueue.ts', () => ({
  getAgentsQueue: () => ({ add, remove }),
  AGENT_PRIORITY: { resume: 1, start: 2 },
}));
jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({
  createAgentRun, cancelAgentRun,
}));

const { startAgent, resumeJobThread, cancelAgent } = await import('../../src/agents/scheduler.ts');

beforeEach(() => {
  add.mockReset().mockResolvedValue({});
  remove.mockReset().mockResolvedValue(1);
  createAgentRun.mockReset().mockResolvedValue({ run_id: 'run-1', thread_id: 'thread-1', status: 'queued' });
  cancelAgentRun.mockReset().mockResolvedValue({ run_id: 'run-1', status: 'cancelled' });
});

describe('startAgent', () => {
  it('records a queued job run and enqueues its start', async () => {
    const run = await startAgent({ user_id: 'user-1', type: 'job', title: 'SWE @ Acme', job_id: 'job-1' });

    expect(createAgentRun).toHaveBeenCalledWith({ user_id: 'user-1', type: 'job', title: 'SWE @ Acme', job_id: 'job-1', status: 'queued' });
    expect(add).toHaveBeenCalledWith('start', { run_id: 'run-1', step: undefined }, expect.objectContaining({ jobId: 'start:run-1', priority: 2 }));
    expect(run.run_id).toBe('run-1');
  });

  it('carries the step a run starts in, without storing it on the run', async () => {
    await startAgent({ user_id: 'user-1', type: 'job', title: 'Apply @ Acme', job_id: 'job-1', step: 'external_apply' });

    expect(createAgentRun.mock.calls[0]![0]).not.toHaveProperty('step');
    expect(add.mock.calls[0]![1]).toEqual({ run_id: 'run-1', step: 'external_apply' });
  });

  it('enqueues nothing when the run cannot be created', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));

    await expect(startAgent({ user_id: 'user-1', type: 'job', title: 'a', job_id: 'job-1' })).rejects.toMatchObject({ status: 409 });
    expect(add).not.toHaveBeenCalled();
  });
});

describe('resumeJobThread', () => {
  it('enqueues the resume ahead of new starts, keyed on thread and step', async () => {
    await resumeJobThread('thread-1', 'external_apply', { approved: true });

    expect(add).toHaveBeenCalledWith('resume', { thread_id: 'thread-1', step: 'external_apply', value: { approved: true } }, expect.objectContaining({
      jobId: 'thread-1:external_apply', priority: 1, removeOnComplete: { age: 86400 },
    }));
  });
});

describe('cancelAgent', () => {
  it('cancels the run and drops its start job', async () => {
    await expect(cancelAgent('run-1', 'user-1')).resolves.toMatchObject({ status: 'cancelled' });

    expect(cancelAgentRun).toHaveBeenCalledWith('run-1', 'user-1');
    expect(remove).toHaveBeenCalledWith('start:run-1');
  });

  it('still cancels when the start job cannot be removed', async () => {
    remove.mockRejectedValue(new Error('job is locked'));

    await expect(cancelAgent('run-1', 'user-1')).resolves.toMatchObject({ status: 'cancelled' });
  });
});
