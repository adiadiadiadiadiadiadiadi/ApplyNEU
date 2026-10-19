import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { MemorySaver } from '@langchain/langgraph';

const jobMatch = jest.fn<(state: any) => Promise<any>>();
const decide = jest.fn<(state: any) => Promise<any>>();
const checkpointer = new MemorySaver();
const add = jest.fn<(name: string, data: unknown, opts: any) => Promise<unknown>>();

jest.unstable_mockModule('../../src/agents/checkpointer.ts', () => ({ checkpointer }));
jest.unstable_mockModule('../../src/agents/jobGraph/nodes.ts', () => ({ jobMatch, decide }));
jest.unstable_mockModule('../../src/queues/jobGraphQueue.ts', () => ({ getJobGraphQueue: () => ({ add }) }));

const { jobGraph, runJobThread, resumeJobThread } = await import('../../src/agents/jobGraph/graph.ts');
const { GRAPH_VERSION } = await import('../../src/agents/jobGraph/state.ts');

beforeEach(() => {
  jobMatch.mockReset().mockResolvedValue({ match_score: 72 });
  decide.mockReset().mockResolvedValue({ decision: 'APPLY' });
  add.mockReset().mockResolvedValue({});
});

describe('runJobThread', () => {
  it('runs jobMatch then decide and returns the final state', async () => {
    const result = await runJobThread('thread-1', { user_id: 'user-1', job_id: 'job-1' });

    expect(jobMatch).toHaveBeenCalledTimes(1);
    expect(decide.mock.calls[0]![0]).toMatchObject({ match_score: 72 });
    expect(result).toEqual({
      user_id: 'user-1',
      job_id: 'job-1',
      match_score: 72,
      decision: 'APPLY',
      graph_version: GRAPH_VERSION,
    });
  });

  it('checkpoints the finished state under the thread id', async () => {
    await runJobThread('thread-2', { user_id: 'user-1', job_id: 'job-1' });

    const saved = await jobGraph.getState({ configurable: { thread_id: 'thread-2' } });
    expect(saved.values).toMatchObject({ match_score: 72, decision: 'APPLY' });
    expect(saved.next).toEqual([]);
  });

  it('keeps separate threads apart', async () => {
    await runJobThread('thread-a', { user_id: 'user-1', job_id: 'job-1' });
    decide.mockResolvedValue({ decision: 'DO_NOT_APPLY' });
    await runJobThread('thread-b', { user_id: 'user-2', job_id: 'job-2' });

    const a = await jobGraph.getState({ configurable: { thread_id: 'thread-a' } });
    const b = await jobGraph.getState({ configurable: { thread_id: 'thread-b' } });
    expect(a.values.decision).toBe('APPLY');
    expect(b.values).toMatchObject({ user_id: 'user-2', decision: 'DO_NOT_APPLY' });
  });
});

describe('resumeJobThread', () => {
  it('enqueues the resume instead of running the graph', async () => {
    await resumeJobThread('thread-1', 'approval', { approved: true });

    expect(add).toHaveBeenCalledWith('resume', { thread_id: 'thread-1', value: { approved: true } }, expect.any(Object));
    expect(jobMatch).not.toHaveBeenCalled();
  });

  it('keys the job on thread and step, so each pause dedupes separately', async () => {
    await resumeJobThread('thread-1', 'approval', { approved: true });
    await resumeJobThread('thread-1', 'submit', {});

    expect(add.mock.calls.map(([, , opts]) => opts.jobId)).toEqual(['thread-1:approval', 'thread-1:submit']);
  });

  it('keeps finished jobs for a day so a repeat resume is ignored, then cleans them up', async () => {
    await resumeJobThread('thread-1', 'approval', { approved: true });

    expect(add.mock.calls[0]![2]).toMatchObject({ removeOnComplete: { age: 86400 }, attempts: 3 });
  });
});
