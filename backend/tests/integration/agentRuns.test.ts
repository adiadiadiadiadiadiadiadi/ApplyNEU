import { jest, it, expect } from '@jest/globals';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: db.pool }));

const { createAgentRun, updateAgentRunStatus, listAgentRuns } = await import('../../src/services/agentRun/agentRun.service.ts');

const newUser = async () => {
    const { rows: [user] } = await db.pool.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`);
    return user.id as string;
};

const newJob = async () => {
    const { rows: [job] } = await db.pool.query(
        `INSERT INTO jobs (company, title, description, description_hash) VALUES ('Acme', 'SWE', 'Build', 'hash') RETURNING job_id`
    );
    return job.job_id as string;
};

describeWithDatabase('agent runs against Postgres', () => {
    it('creates a job run under its sweep and lists it as running', async () => {
        const user_id = await newUser();
        const job_id = await newJob();

        const sweep = await createAgentRun({ user_id, type: 'sweep', title: 'NUWorks sweep', status: 'running' });
        const run = await createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id, parent_run_id: sweep.run_id, status: 'running' });

        expect(sweep.thread_id).toBeNull();
        expect(run.thread_id).toEqual(expect.any(String));
        expect(run.parent_run_id).toBe(sweep.run_id);

        const groups = await listAgentRuns(user_id);
        expect(groups.running.map((r) => r.run_id).sort()).toEqual([sweep.run_id, run.run_id].sort());
    });

    it('moves a run between groups as its status changes', async () => {
        const user_id = await newUser();
        const run = await createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id: await newJob() });

        await updateAgentRunStatus(run.run_id, 'waiting_for_you');
        expect((await listAgentRuns(user_id)).needs_you.map((r) => r.run_id)).toEqual([run.run_id]);

        const done = await updateAgentRunStatus(run.run_id, 'done');
        expect(new Date(done.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(run.updated_at).getTime());
        expect((await listAgentRuns(user_id)).recent.map((r) => r.run_id)).toEqual([run.run_id]);
    });

    it("doesn't list another user's runs", async () => {
        const owner = await newUser();
        await createAgentRun({ user_id: owner, type: 'sweep', title: 'NUWorks sweep' });

        const groups = await listAgentRuns(await newUser());
        expect(groups).toEqual({ needs_you: [], running: [], queued: [], recent: [] });
    });

    it('allows a new run once the previous one for the job finished, but not two active ones', async () => {
        const user_id = await newUser();
        const job_id = await newJob();

        const first = await createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id });
        await updateAgentRunStatus(first.run_id, 'done');
        await createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id });

        await expect(createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id })).rejects.toMatchObject({ status: 409 });
    });
});
