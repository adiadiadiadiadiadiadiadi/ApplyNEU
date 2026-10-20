import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

const add = jest.fn<(name: string, data: unknown, opts: any) => Promise<unknown>>();
const getJob = jest.fn<(id: string) => Promise<any>>();
const remove = jest.fn<(id: string) => Promise<number>>();
const createAgentRun = jest.fn<(run: any) => Promise<any>>();
const getAgentRunForUser = jest.fn<(run_id: string, user_id: string) => Promise<any>>();
const cancelAgentRun = jest.fn<(run_id: string, user_id: string) => Promise<any>>();

jest.unstable_mockModule('../../src/queues/agentsQueue.ts', () => ({
  getAgentsQueue: () => ({ add, getJob, remove }),
  AGENT_PRIORITY: { resume: 1, blocking: 2, user: 3, router: 4 },
}));
jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({
  createAgentRun, getAgentRunForUser, cancelAgentRun,
}));

const { startAgent, resumeJobThread, runAgentNow, cancelAgent } = await import('../../src/agents/scheduler.ts');

const queuedJob = (overrides: Record<string, unknown> = {}) => ({
  data: { run_id: 'run-1' },
  updateData: jest.fn(async () => {}),
  isDelayed: jest.fn(async () => false),
  promote: jest.fn(async () => {}),
  changePriority: jest.fn(async () => {}),
  ...overrides,
});

beforeEach(() => {
  add.mockReset().mockResolvedValue({});
  getJob.mockReset();
  remove.mockReset().mockResolvedValue(1);
  createAgentRun.mockReset().mockResolvedValue({ run_id: 'run-1', thread_id: 'thread-1', status: 'queued' });
  getAgentRunForUser.mockReset().mockResolvedValue({ run_id: 'run-1', status: 'queued' });
  cancelAgentRun.mockReset().mockResolvedValue({ run_id: 'run-1', status: 'cancelled' });
});

describe('startAgent', () => {
  it('records a queued run and enqueues its start', async () => {
    const run = await startAgent({ user_id: 'user-1', type: 'external_apply', title: 'Apply @ Acme', job_id: 'job-1', source: 'router' });

    expect(createAgentRun).toHaveBeenCalledWith({ user_id: 'user-1', type: 'external_apply', title: 'Apply @ Acme', job_id: 'job-1', status: 'queued' });
    expect(add).toHaveBeenCalledWith('start', { run_id: 'run-1' }, expect.objectContaining({ jobId: 'start:run-1', priority: 4 }));
    expect(run.run_id).toBe('run-1');
  });

  it('orders runs the sweep is blocked on, then user-started runs, ahead of router runs', async () => {
    await startAgent({ user_id: 'user-1', type: 'cover_letter', title: 'Cover letter', job_id: 'job-1', source: 'blocking' });
    await startAgent({ user_id: 'user-1', type: 'external_apply', title: 'Apply', job_id: 'job-1', source: 'user' });
    await startAgent({ user_id: 'user-1', type: 'external_apply', title: 'Apply', job_id: 'job-1', source: 'router' });

    expect(add.mock.calls.map(([, , opts]) => opts.priority)).toEqual([2, 3, 4]);
  });

  it('enqueues nothing when the run cannot be created', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));

    await expect(startAgent({ user_id: 'user-1', type: 'external_apply', title: 'a', job_id: 'job-1', source: 'router' })).rejects.toMatchObject({ status: 409 });
    expect(add).not.toHaveBeenCalled();
  });
});

describe('resumeJobThread', () => {
  it('enqueues the resume at the highest priority, keyed on thread and step', async () => {
    await resumeJobThread('thread-1', 'approval', { approved: true });

    expect(add).toHaveBeenCalledWith('resume', { thread_id: 'thread-1', value: { approved: true } }, expect.objectContaining({
      jobId: 'thread-1:approval', priority: 1, removeOnComplete: { age: 86400 },
    }));
  });
});

describe('runAgentNow', () => {
  it('forces the start job and moves it ahead of every prioritized job', async () => {
    const job = queuedJob();
    getJob.mockResolvedValue(job);

    await runAgentNow('run-1', 'user-1');

    expect(getJob).toHaveBeenCalledWith('start:run-1');
    expect(job.updateData).toHaveBeenCalledWith({ run_id: 'run-1', force: true });
    expect(job.changePriority).toHaveBeenCalledWith({ priority: 0 });
    expect(job.promote).not.toHaveBeenCalled();
  });

  it('promotes a start job that was waiting for a slot', async () => {
    const job = queuedJob({ isDelayed: jest.fn(async () => true) });
    getJob.mockResolvedValue(job);

    await runAgentNow('run-1', 'user-1');

    expect(job.promote).toHaveBeenCalled();
  });

  it('refuses a run that is not queued', async () => {
    getAgentRunForUser.mockResolvedValue({ run_id: 'run-1', status: 'running' });

    await expect(runAgentNow('run-1', 'user-1')).rejects.toMatchObject({ status: 409 });
    expect(getJob).not.toHaveBeenCalled();
  });

  it('refuses when the start job is gone', async () => {
    getJob.mockResolvedValue(undefined);

    await expect(runAgentNow('run-1', 'user-1')).rejects.toMatchObject({ status: 409 });
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
