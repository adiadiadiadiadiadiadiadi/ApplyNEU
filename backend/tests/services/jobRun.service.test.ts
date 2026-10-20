import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';
import { normalizeAndHash } from '../../src/utils/hash.ts';

const addJob = jest.fn<(company: string, title: string, description: string) => Promise<any>>();
const createAgentRun = jest.fn<(run: any) => Promise<any>>();
const getActiveJobRun = jest.fn<(user_id: string, job_id: string) => Promise<any>>();
const updateAgentRunStatus = jest.fn<(run_id: string, status: string) => Promise<any>>();
const getInstructions = jest.fn<(description_hash: string) => Promise<any>>();
const runJobThread = jest.fn<(thread_id: string, input: any) => Promise<any>>();
const getState = jest.fn<(config: any) => Promise<any>>();

jest.unstable_mockModule('../../src/services/job.service.ts', () => ({ addJob }));
jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({
  createAgentRun, getActiveJobRun, updateAgentRunStatus,
}));
jest.unstable_mockModule('../../src/services/instructions/instructions.service.ts', () => ({ getInstructions }));
jest.unstable_mockModule('../../src/agents/jobGraph/graph.ts', () => ({ jobGraph: { getState }, runJobThread }));

const { analyzeJob } = await import('../../src/services/jobRun/jobRun.service.ts');

const USER_ID = 'user-1';
const DESCRIPTION = 'Build things.';
const JOB = { job_id: 'job-1', company: 'Acme', title: 'SWE Co-op', description: DESCRIPTION };
const RUN = { run_id: 'run-1', thread_id: 'thread-1', status: 'running' };
const INSTRUCTIONS = [{ kind: 'other', instruction: 'Email Acme recruiting', description: 'jobs@acme.example' }];
const FINAL = {
  user_id: USER_ID, job_id: 'job-1', match_score: 72, rationale: 'Good fit.', decision: 'APPLY', requires_approval: true,
};

const snapshot = ({ next = [] as string[], interrupted = false, values = {} as object } = {}) => ({
  values,
  next,
  tasks: next.map((name) => ({ name, interrupts: interrupted ? [{ value: 'approval' }] : [] })),
});

const analyze = () => analyzeJob(USER_ID, DESCRIPTION, 'Acme', 'SWE Co-op');

beforeEach(() => {
  addJob.mockReset().mockResolvedValue(JOB);
  createAgentRun.mockReset().mockResolvedValue(RUN);
  getActiveJobRun.mockReset().mockResolvedValue(null);
  updateAgentRunStatus.mockReset().mockResolvedValue(undefined);
  getInstructions.mockReset().mockResolvedValue(INSTRUCTIONS);
  runJobThread.mockReset().mockResolvedValue(FINAL);
  getState.mockReset()
    .mockResolvedValueOnce(snapshot())
    .mockResolvedValueOnce(snapshot({ values: FINAL }));
});

describe('analyzeJob', () => {
  it('creates a running job run for the posting and runs its thread', async () => {
    await analyze();

    expect(addJob).toHaveBeenCalledWith('Acme', 'SWE Co-op', DESCRIPTION);
    expect(createAgentRun).toHaveBeenCalledWith({
      user_id: USER_ID, type: 'job', title: 'SWE Co-op at Acme', job_id: 'job-1', status: 'running',
    });
    expect(runJobThread).toHaveBeenCalledWith('thread-1', { user_id: USER_ID, job_id: 'job-1' });
  });

  it("answers from the thread's state with the posting's instructions", async () => {
    const result = await analyze();

    expect(getInstructions).toHaveBeenCalledWith(normalizeAndHash(DESCRIPTION));
    expect(result).toEqual({
      decision: 'APPLY',
      match_score: 72,
      rationale: 'Good fit.',
      requires_approval: true,
      employer_instructions: INSTRUCTIONS,
    });
  });

  it('returns no instructions when the memo has none', async () => {
    getInstructions.mockResolvedValue(null);

    const result = await analyze();

    expect(result.employer_instructions).toEqual([]);
  });

  it('marks the run done when the thread ends', async () => {
    await analyze();

    expect(updateAgentRunStatus).toHaveBeenCalledWith('run-1', 'done');
  });

  it('marks the run waiting_for_you when the thread pauses', async () => {
    getState.mockReset()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ next: ['approval'], interrupted: true, values: FINAL }));

    await analyze();

    expect(updateAgentRunStatus).toHaveBeenCalledWith('run-1', 'waiting_for_you');
  });

  it('loads the active run when the job already has one', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));
    getActiveJobRun.mockResolvedValue({ run_id: 'run-0', thread_id: 'thread-0', status: 'running' });

    await analyze();

    expect(getActiveJobRun).toHaveBeenCalledWith(USER_ID, 'job-1');
    expect(runJobThread).toHaveBeenCalledWith('thread-0', { user_id: USER_ID, job_id: 'job-1' });
    expect(updateAgentRunStatus).toHaveBeenCalledWith('run-0', 'done');
  });

  it('answers a thread already paused on the user without running it again', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));
    getActiveJobRun.mockResolvedValue({ run_id: 'run-0', thread_id: 'thread-0', status: 'waiting_for_you' });
    const paused = snapshot({ next: ['approval'], interrupted: true, values: FINAL });
    getState.mockReset().mockResolvedValue(paused);

    const result = await analyze();

    expect(runJobThread).not.toHaveBeenCalled();
    expect(updateAgentRunStatus).toHaveBeenCalledWith('run-0', 'waiting_for_you');
    expect(result).toMatchObject({ decision: 'APPLY', match_score: 72 });
  });

  it('rethrows the 409 when the active run finished before it could be loaded', async () => {
    createAgentRun.mockRejectedValue(new AppError(409, 'This job already has an active run.'));

    await expect(analyze()).rejects.toMatchObject({ status: 409 });
    expect(runJobThread).not.toHaveBeenCalled();
  });

  it('does not look for an active run on other create errors', async () => {
    createAgentRun.mockRejectedValue(new AppError(500, 'Error creating agent run.'));

    await expect(analyze()).rejects.toMatchObject({ status: 500 });
    expect(getActiveJobRun).not.toHaveBeenCalled();
  });

  it('marks the run failed and rethrows when the thread throws', async () => {
    runJobThread.mockRejectedValue(new AppError(429, 'Too many requests.', 30));

    await expect(analyze()).rejects.toMatchObject({ status: 429, retryAfter: 30 });
    expect(updateAgentRunStatus).toHaveBeenCalledWith('run-1', 'failed');
    expect(getInstructions).not.toHaveBeenCalled();
  });

  it("still rethrows the thread's error when marking the run failed fails", async () => {
    runJobThread.mockRejectedValue(new AppError(404, 'Resume not found.'));
    updateAgentRunStatus.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(analyze()).rejects.toMatchObject({ status: 404 });
  });
});
