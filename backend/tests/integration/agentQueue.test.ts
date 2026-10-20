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

const newUser = async (num_agents?: number) => {
    const { rows: [user] } = await db.pool.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`);
    if (num_agents) await db.pool.query(`UPDATE preferences SET num_agents = $2 WHERE user_id = $1`, [user.id, num_agents]);
    return user.id as string;
};

const newJob = async () => {
    const { rows: [job] } = await db.pool.query(
        `INSERT INTO jobs (company, title, description, description_hash) VALUES ('Acme', 'SWE', $1, $1) RETURNING job_id`,
        [`posting ${Math.random()}`]
    );
    return job.job_id as string;
};

const queuedJobRun = async (user_id: string) =>
    createAgentRun({ user_id, type: 'job', title: 'SWE @ Acme', job_id: await newJob() });

describeWithDatabase('agent slots against Postgres', () => {
    it('lets a user run up to num_agents at once, then reports full', async () => {
        const user = await newUser(2);
        const runs = [await queuedJobRun(user), await queuedJobRun(user), await queuedJobRun(user)];

        expect(await claimAgentRun(runs[0]!.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(runs[1]!.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(runs[2]!.run_id, ['queued'])).toBe('full');
        expect((await getAgentRun(runs[2]!.run_id)).status).toBe('queued');
    });

    it('follows the user\'s own num_agents', async () => {
        const user = await newUser(1);
        const first = await queuedJobRun(user);
        const second = await queuedJobRun(user);

        expect(await claimAgentRun(first.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(second.run_id, ['queued'])).toBe('full');
    });

    it('frees a slot while a run waits on the user', async () => {
        const user = await newUser(1);
        const first = await queuedJobRun(user);
        const second = await queuedJobRun(user);
        await claimAgentRun(first.run_id, ['queued']);

        await moveAgentRun(first.run_id, ['running'], 'waiting_for_you');

        expect(await claimAgentRun(second.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(first.run_id, ['waiting_for_you'])).toBe('full');
    });

    it('defaults to 15 running agents at once', async () => {
        const user = await newUser();
        const runs = [];
        for (let i = 0; i < 16; i += 1) runs.push(await queuedJobRun(user));

        for (const run of runs.slice(0, 15)) expect(await claimAgentRun(run.run_id, ['queued'])).toBe('claimed');
        expect(await claimAgentRun(runs[15]!.run_id, ['queued'])).toBe('full');
    });

    it('does not count other users\' runs', async () => {
        const busy = await newUser(1);
        await claimAgentRun((await queuedJobRun(busy)).run_id, ['queued']);

        const other = await newUser(1);
        expect(await claimAgentRun((await queuedJobRun(other)).run_id, ['queued'])).toBe('claimed');
    });

    it('reports a cancelled run as gone and leaves it cancelled', async () => {
        const user = await newUser();
        const run = await queuedJobRun(user);
        await cancelAgentRun(run.run_id, user);

        expect(await claimAgentRun(run.run_id, ['queued'])).toBe('gone');
        expect(await moveAgentRun(run.run_id, ['running'], 'done')).toBe(false);
        expect((await getAgentRun(run.run_id)).status).toBe('cancelled');
    });

    it('refuses to cancel a finished run or someone else\'s', async () => {
        const user = await newUser();
        const run = await queuedJobRun(user);

        await expect(cancelAgentRun(run.run_id, await newUser())).rejects.toMatchObject({ status: 404 });
        await moveAgentRun(run.run_id, ['queued'], 'done');
        await expect(cancelAgentRun(run.run_id, user)).rejects.toMatchObject({ status: 409 });
    });
});
