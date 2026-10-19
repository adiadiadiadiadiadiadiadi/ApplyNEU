import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const query = jest.fn<(text: string, params?: any[]) => Promise<any>>();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: { query } }));

const { listAgentRuns, createAgentRun, updateAgentRunStatus } = await import('../../src/services/agentRun/agentRun.service.ts');

const USER_ID = 'user-1';

const run = (run_id: string, status: string) => ({
  run_id,
  type: 'job',
  parent_run_id: null,
  job_id: 'job-1',
  status,
  title: `Run ${run_id}`,
  started_at: '2026-10-18T00:00:00Z',
  updated_at: '2026-10-18T00:00:00Z',
});

const activeCall = () => query.mock.calls.find(([sql]) => sql.includes("'waiting_for_you'"))!;
const recentCall = () => query.mock.calls.find(([sql]) => sql.includes("'done'"))!;

beforeEach(() => {
  query.mockReset();
});

describe('listAgentRuns', () => {
  it('groups active runs by status and returns finished runs as recent', async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes("'waiting_for_you'")
        ? { rows: [run('a', 'waiting_for_you'), run('b', 'running'), run('c', 'queued'), run('d', 'running')] }
        : { rows: [run('e', 'done'), run('f', 'failed')] }
    );

    const groups = await listAgentRuns(USER_ID);

    expect(groups.needs_you.map((r) => r.run_id)).toEqual(['a']);
    expect(groups.running.map((r) => r.run_id)).toEqual(['b', 'd']);
    expect(groups.queued.map((r) => r.run_id)).toEqual(['c']);
    expect(groups.recent.map((r) => r.run_id)).toEqual(['e', 'f']);
  });

  it("scopes both queries to the caller and caps the finished runs", async () => {
    query.mockResolvedValue({ rows: [] });

    await listAgentRuns(USER_ID);

    expect(activeCall()[1]).toEqual([USER_ID]);
    expect(recentCall()[1]).toEqual([USER_ID, 20]);
    expect(recentCall()[0]).toContain('LIMIT $2');
  });

  it('never selects user_id or thread_id', async () => {
    query.mockResolvedValue({ rows: [] });

    await listAgentRuns(USER_ID);

    for (const [sql] of query.mock.calls) {
      const columns = sql.slice(sql.indexOf('SELECT'), sql.indexOf('FROM'));
      expect(columns).not.toMatch(/user_id|thread_id/);
    }
  });

  it('returns empty groups for a user with no runs', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(listAgentRuns(USER_ID)).resolves.toEqual({ needs_you: [], running: [], queued: [], recent: [] });
  });

  it('throws 500 when a query fails', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    await expect(listAgentRuns(USER_ID)).rejects.toMatchObject({ status: 500 });
  });
});

describe('createAgentRun', () => {
  const lastParams = () => query.mock.calls[query.mock.calls.length - 1]![1]!;

  it('creates a job run with a fresh thread id and returns it', async () => {
    query.mockImplementation(async (_sql: string, params?: any[]) => ({ rows: [{ ...run('r1', params![6]), thread_id: params![5] }] }));

    const created = await createAgentRun({ user_id: USER_ID, type: 'job', title: 'SWE Co-op @ Acme', job_id: 'job-1', parent_run_id: 'sweep-1' });

    const [user_id, type, title, job_id, parent_run_id, thread_id, status] = lastParams();
    expect([user_id, type, title, job_id, parent_run_id, status]).toEqual([USER_ID, 'job', 'SWE Co-op @ Acme', 'job-1', 'sweep-1', 'queued']);
    expect(thread_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.thread_id).toBe(thread_id);
  });

  it('gives each run a different thread id', async () => {
    query.mockResolvedValue({ rows: [{}] });

    await createAgentRun({ user_id: USER_ID, type: 'job', title: 'a', job_id: 'job-1' });
    await createAgentRun({ user_id: USER_ID, type: 'job', title: 'b', job_id: 'job-2' });

    expect(query.mock.calls[0]![1]![5]).not.toBe(query.mock.calls[1]![1]![5]);
  });

  it('creates a sweep with no thread, job or parent', async () => {
    query.mockResolvedValue({ rows: [{}] });

    await createAgentRun({ user_id: USER_ID, type: 'sweep', title: 'NUWorks sweep', status: 'running' });

    expect(lastParams()).toEqual([USER_ID, 'sweep', 'NUWorks sweep', null, null, null, 'running']);
  });

  it('throws 409 when the job already has an active run', async () => {
    query.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'agent_runs_one_active_job' }));

    await expect(createAgentRun({ user_id: USER_ID, type: 'job', title: 'a', job_id: 'job-1' })).rejects.toMatchObject({ status: 409 });
  });

  it('throws 500 for any other failure', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    await expect(createAgentRun({ user_id: USER_ID, type: 'job', title: 'a', job_id: 'job-1' })).rejects.toMatchObject({ status: 500 });
  });
});

describe('updateAgentRunStatus', () => {
  it('sets the status and bumps updated_at', async () => {
    query.mockResolvedValue({ rows: [run('r1', 'waiting_for_you')] });

    const updated = await updateAgentRunStatus('r1', 'waiting_for_you');

    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('updated_at = now()');
    expect(params).toEqual(['r1', 'waiting_for_you']);
    expect(updated.status).toBe('waiting_for_you');
  });

  it('throws 404 when the run does not exist', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(updateAgentRunStatus('missing', 'done')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 500 when the update fails', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    await expect(updateAgentRunStatus('r1', 'done')).rejects.toMatchObject({ status: 500 });
  });
});
