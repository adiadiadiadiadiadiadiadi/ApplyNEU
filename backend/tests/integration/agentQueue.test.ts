import { jest, it, expect } from '@jest/globals';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

// claimAgentRun runs its own transaction on a dedicated client. Each test already runs inside
// one, so the claim's BEGIN/COMMIT/ROLLBACK become a savepoint on the same connection.
const SAVEPOINT: Record<string, string> = {
    BEGIN: 'SAVEPOINT claim',
    COMMIT: 'RELEASE SAVEPOINT claim',
    ROLLBACK: 'ROLLBACK TO SAVEPOINT claim',
};
const pool = {
    query: db.pool.query,
    connect: async () => ({
        query: (text: string, params?: unknown[]) => db.pool.query(SAVEPOINT[text] ?? text, params),
        release: () => {},
    }),
};

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool }));

const { createAgentRun, claimAgentRun, cancelAgentRun, moveAgentRun, getAgentRun } =
    await import('../../src/services/agentRun/agentRun.service.ts');

const newUser = async (max_agents?: number) => {
    const { rows: [user] } = await db.pool.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`);
    if (max_agents) await db.pool.query(`UPDATE preferences SET max_agents = $2 WHERE user_id = $1`, [user.id, max_agents]);
    return user.id as string;
};

const newJob = async () => {
    const { rows: [job] } = await db.pool.query(
        `INSERT INTO jobs (company, title, description, description_hash) VALUES ('Acme', 'SWE', $1, $1) RETURNING job_id`,
        [`posting ${Math.random()}`]
    );
    return job.job_id as string;
};

const queuedBrowserRun = async (user_id: string) =>
    createAgentRun({ user_id, type: 'external_apply', title: 'Apply @ Acme', job_id: await newJob() });

describeWithDatabase('agent slots against Postgres', () => {
    it('lets a user run up to max_agents at once, then reports full', async () => {
        const user = await newUser();
        const runs = [await queuedBrowserRun(user), await queuedBrowserRun(user), await queuedBrowserRun(user)];

        expect(await claimAgentRun(runs[0]!.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(runs[1]!.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(runs[2]!.run_id, ['queued'])).toBe('full');
        expect((await getAgentRun(runs[2]!.run_id)).status).toBe('queued');
    });

    it('follows the user\'s own max_agents', async () => {
        const user = await newUser(1);
        const first = await queuedBrowserRun(user);
        const second = await queuedBrowserRun(user);

        expect(await claimAgentRun(first.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(second.run_id, ['queued'])).toBe('full');
    });

    it('frees a slot while a run waits on the user', async () => {
        const user = await newUser(1);
        const first = await queuedBrowserRun(user);
        const second = await queuedBrowserRun(user);
        await claimAgentRun(first.run_id, ['queued']);

        await moveAgentRun(first.run_id, ['running'], 'waiting_for_you');

        expect(await claimAgentRun(second.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(first.run_id, ['waiting_for_you'])).toBe('full');
    });

    it('lets run-now go past max_agents', async () => {
        const user = await newUser(1);
        const first = await queuedBrowserRun(user);
        const second = await queuedBrowserRun(user);
        await claimAgentRun(first.run_id, ['queued']);

        expect(await claimAgentRun(second.run_id, ['queued'], { force: true })).toBe('claimed');
    });

    it('never makes a non-browser run wait, and never counts it', async () => {
        const user = await newUser(1);
        const coverLetter = await createAgentRun({ user_id: user, type: 'cover_letter', title: 'Cover letter', job_id: await newJob() });
        const browser = await queuedBrowserRun(user);
        const jobThread = await createAgentRun({ user_id: user, type: 'job', title: 'SWE @ Acme', job_id: await newJob() });

        expect(await claimAgentRun(coverLetter.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(browser.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(jobThread.run_id, ['queued'])).toBe('claimed');
    });

    it('does not count other users\' runs', async () => {
        const busy = await newUser(1);
        await claimAgentRun((await queuedBrowserRun(busy)).run_id, ['queued']);

        const other = await newUser(1);
        expect(await claimAgentRun((await queuedBrowserRun(other)).run_id, ['queued'])).toBe('claimed');
    });

    it('reports a cancelled run as gone and leaves it cancelled', async () => {
        const user = await newUser();
        const run = await queuedBrowserRun(user);
        await cancelAgentRun(run.run_id, user);

        expect(await claimAgentRun(run.run_id, ['queued'])).toBe('gone');
        expect(await moveAgentRun(run.run_id, ['running'], 'done')).toBe(false);
        expect((await getAgentRun(run.run_id)).status).toBe('cancelled');
    });

    it('refuses to cancel a finished run or someone else\'s', async () => {
        const user = await newUser();
        const run = await queuedBrowserRun(user);

        await expect(cancelAgentRun(run.run_id, await newUser())).rejects.toMatchObject({ status: 404 });
        await moveAgentRun(run.run_id, ['queued'], 'done');
        await expect(cancelAgentRun(run.run_id, user)).rejects.toMatchObject({ status: 409 });
    });
});
