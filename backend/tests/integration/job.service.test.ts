import { jest, it, expect } from '@jest/globals';
import { normalizeAndHash } from '../../src/utils/hash.ts';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: db.pool }));

const { addJob } = await import('../../src/services/job.service.ts');

const COMPANY = 'Acme';
const TITLE = 'Software Engineer';
const DESCRIPTION = 'We are hiring a Software Engineer to build great things.';
const REPOSTED_DESCRIPTION = 'We are hiring a Software Engineer for a brand new platform team.';

describeWithDatabase('addJob against Postgres', () => {
    it('gives a reposted job with a changed description a distinct job_id', async () => {
        const original = await addJob(COMPANY, TITLE, DESCRIPTION);
        const reposted = await addJob(COMPANY, TITLE, REPOSTED_DESCRIPTION);

        expect(reposted.job_id).not.toBe(original.job_id);
        expect(reposted.description).toBe(REPOSTED_DESCRIPTION);

        const { rows } = await db.pool.query(
            `SELECT job_id, description FROM jobs WHERE company = $1 AND title = $2 ORDER BY description`,
            [COMPANY, TITLE]
        );
        expect(rows).toHaveLength(2);
    });

    it('returns the existing row when the same description is posted again', async () => {
        const first = await addJob(COMPANY, TITLE, DESCRIPTION);
        const second = await addJob(COMPANY, TITLE, `  ${DESCRIPTION.toUpperCase().replace(/ /g, '   ')}  `);

        expect(second.job_id).toBe(first.job_id);

        const { rows } = await db.pool.query(`SELECT count(*)::int AS count FROM jobs`);
        expect(rows[0].count).toBe(1);
    });

    it('stores the hash of the normalized description', async () => {
        const job = await addJob(COMPANY, TITLE, DESCRIPTION);
        expect(job.description_hash).toBe(normalizeAndHash(DESCRIPTION));
    });

    it('rolls back between tests', async () => {
        const { rows } = await db.pool.query(`SELECT count(*)::int AS count FROM jobs`);
        expect(rows[0].count).toBe(0);
    });

    it('cascades job_applications when the job is deleted', async () => {
        const job = await addJob(COMPANY, TITLE, DESCRIPTION);
        const { rows: [user] } = await db.pool.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`);

        await db.pool.query(`INSERT INTO job_applications (job_id, user_id) VALUES ($1, $2)`, [job.job_id, user.id]);
        await db.pool.query(`DELETE FROM jobs WHERE job_id = $1`, [job.job_id]);

        const { rows } = await db.pool.query(`SELECT count(*)::int AS count FROM job_applications`);
        expect(rows[0].count).toBe(0);
    });
});
