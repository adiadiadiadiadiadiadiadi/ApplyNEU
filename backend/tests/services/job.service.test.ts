import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { normalizeAndHash } from '../../src/utils/hash.ts';

const query = jest.fn<(text: string, params?: any[]) => Promise<any>>();

jest.unstable_mockModule('../../src/db/index.ts', () => ({
    pool: { query },
}));

const { addJob } = await import('../../src/services/job.service.ts');

const COMPANY = 'Acme';
const TITLE = 'Software Engineer';
const DESCRIPTION = 'We are hiring a Software Engineer to build great things.';

const jobRow = (job_id: string, description: string) => ({
    rows: [{ job_id, company: COMPANY, title: TITLE, description, description_hash: normalizeAndHash(description) }],
});

const lastCall = () => query.mock.calls[query.mock.calls.length - 1]!;

beforeEach(() => {
    query.mockReset();
});

describe('addJob', () => {
    it('conflicts on (company, title, description_hash) rather than (company, title)', async () => {
        query.mockResolvedValue(jobRow('job-1', DESCRIPTION));

        await addJob(COMPANY, TITLE, DESCRIPTION);

        const [sql] = lastCall();
        expect(sql).toMatch(/ON CONFLICT \(company, title, description_hash\)/);
        expect(sql).not.toMatch(/ON CONFLICT \(company, title\)/);
    });

    it('passes the hash of the normalized description as the fourth parameter', async () => {
        query.mockResolvedValue(jobRow('job-1', DESCRIPTION));

        await addJob(COMPANY, TITLE, DESCRIPTION);

        expect(lastCall()[1]).toEqual([COMPANY, TITLE, DESCRIPTION, normalizeAndHash(DESCRIPTION)]);
    });

    it('sends an unchanged hash for a description differing only in whitespace and case', async () => {
        query.mockResolvedValue(jobRow('job-1', DESCRIPTION));

        await addJob(COMPANY, TITLE, DESCRIPTION);
        const first = lastCall()[1]![3];

        await addJob(COMPANY, TITLE, `  ${DESCRIPTION.toUpperCase().replace(/ /g, '   ')}  `);
        expect(lastCall()[1]![3]).toBe(first);
    });

    it('throws when the insert returns no row', async () => {
        query.mockResolvedValue({ rows: [] });

        await expect(addJob(COMPANY, TITLE, DESCRIPTION)).rejects.toMatchObject({ status: 500 });
    });
});
