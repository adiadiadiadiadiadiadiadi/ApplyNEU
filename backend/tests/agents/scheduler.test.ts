import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

const addBulk = jest.fn<(jobs: any[]) => Promise<unknown>>();
const remove = jest.fn<(id: string) => Promise<number>>();
const upsertJobScheduler = jest.fn<(id: string, repeat: any, template: any) => Promise<unknown>>();
const createAgentRun = jest.fn<(run: any) => Promise<any>>();
const cancelAgentRun = jest.fn<(run_id: string, user_id: string) => Promise<any>>();
const wakeNextRuns = jest.fn<(user_id: string) => Promise<any[]>>();
const answerAgentRun = jest.fn<(thread_id: string, step: string, value: unknown) => Promise<any[]>>();
const wakeStalledRuns = jest.fn<() => Promise<any[]>>();

jest.unstable_mockModule('../../src/queues/agentsQueue.ts', () => ({
  getAgentsQueue: () => ({ addBulk, remove, upsertJobScheduler }),
  AGENT_PRIORITY: { resume: 1, start: 2 },
}));
jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({
  createAgentRun, cancelAgentRun, wakeNextRuns, answerAgentRun, wakeStalledRuns,
}));

const { startAgent, resumeJobThread, cancelAgent, wakeStalledAgents, scheduleWakeStalledAgents } =
  await import('../../src/agents/scheduler.ts');

const START = { run_id: 'run-1', thread_id: 'thread-1', resume: null };
const RESUME = { run_id: 'run-2', thread_id: 'thread-2', resume: { step: 'approval', value: { approved: true } } };

const startJob = (run_id: string) =>
  expect.objectContaining({ name: 'start', data: { run_id }, opts: expect.objectContaining({ jobId: `start:${run_id}`, priority: 2 }) });

beforeEach(() => {
  addBulk.mockReset().mockResolvedValue([]);
  remove.mockReset().mockResolvedValue(1);
  upsertJobScheduler.mockReset().mockResolvedValue({});
  createAgentRun.mockReset().mockResolvedValue({ run_id: 'run-1', thread_id: 'thread-1', status: 'queued' });
  cancelAgentRun.mockReset().mockResolvedValue({ run: { run_id: 'run-1', status: 'cancelled' }, woken: [] });
  wakeNextRuns.mockReset().mockResolvedValue([START]);
  answerAgentRun.mockReset().mockResolvedValue([RESUME]);
  wakeStalledRuns.mockReset().mockResolvedValue([]);
});

describe('startAgent', () => {
  it('records a queued job run and enqueues its start once it has a slot', async () => {
    const run = await startAgent({ user_id: 'user-1', type: 'job', title: 'SWE @ Acme', job_id: 'job-1' });

    expect(createAgentRun).toHaveBeenCalledWith({ user_id: 'user-1', type: 'job', title: 'SWE @ Acme', job_id: 'job-1', status: 'queued' });
    expect(wakeNextRuns).toHaveBeenCalledWith('user-1');
    expect(addBulk).toHaveBeenCalledWith([startJob('run-1')]);
    expect(run.run_id).toBe('run-1');
  });

  it('enqueues nothing while the user has no free slot', async () => {
    wakeNextRuns.mockResolvedValue([]);

    await startAgent({ user_id: 'user-1', type: 'job', title: 'a', job_id: 'job-1' });

    expect(addBulk).not.toHaveBeenCalled();
  });

  it('enqueues nothing when the run cannot be created', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));

    await expect(startAgent({ user_id: 'user-1', type: 'job', title: 'a', job_id: 'job-1' })).rejects.toMatchObject({ status: 409 });
    expect(addBulk).not.toHaveBeenCalled();
  });
});

describe('resumeJobThread', () => {
  it('records the answer and enqueues the resume ahead of new starts, keyed on thread and step', async () => {
    await resumeJobThread('thread-2', 'approval', { approved: true });

    expect(answerAgentRun).toHaveBeenCalledWith('thread-2', 'approval', { approved: true });
    expect(addBulk).toHaveBeenCalledWith([expect.objectContaining({
      name: 'resume',
      data: { thread_id: 'thread-2', value: { approved: true } },
      opts: expect.objectContaining({ jobId: 'thread-2:approval', priority: 1, removeOnComplete: { age: 86400 } }),
    })]);
  });

  it('enqueues nothing while the user has no free slot', async () => {
    answerAgentRun.mockResolvedValue([]);

    await resumeJobThread('thread-2', 'approval', { approved: true });

    expect(addBulk).not.toHaveBeenCalled();
  });
});

describe('cancelAgent', () => {
  it('cancels the run, drops its start job, and starts the run the slot went to', async () => {
    cancelAgentRun.mockResolvedValue({ run: { run_id: 'run-1', status: 'cancelled' }, woken: [{ ...START, run_id: 'run-3' }] });

    await expect(cancelAgent('run-1', 'user-1')).resolves.toMatchObject({ status: 'cancelled' });

    expect(cancelAgentRun).toHaveBeenCalledWith('run-1', 'user-1');
    expect(remove).toHaveBeenCalledWith('start:run-1');
    expect(addBulk).toHaveBeenCalledWith([startJob('run-3')]);
  });

  it('still cancels when the start job cannot be removed', async () => {
    remove.mockRejectedValue(new Error('job is locked'));

    await expect(cancelAgent('run-1', 'user-1')).resolves.toMatchObject({ status: 'cancelled' });
  });
});

describe('wakeStalledAgents', () => {
  it('enqueues the job of every run holding a slot, starts and resumes alike', async () => {
    wakeStalledRuns.mockResolvedValue([START, RESUME]);

    await wakeStalledAgents();

    expect(addBulk).toHaveBeenCalledWith([
      startJob('run-1'),
      expect.objectContaining({ name: 'resume', opts: expect.objectContaining({ jobId: 'thread-2:approval' }) }),
    ]);
  });

  it('schedules itself every minute', async () => {
    await scheduleWakeStalledAgents();

    expect(upsertJobScheduler).toHaveBeenCalledWith('wake', { every: 60_000 }, expect.objectContaining({ name: 'wake' }));
  });
});
