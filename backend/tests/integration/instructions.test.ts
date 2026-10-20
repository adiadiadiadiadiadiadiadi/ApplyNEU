import { jest, it, expect, beforeEach } from '@jest/globals';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: db.pool }));
jest.unstable_mockModule('../../src/db/redis.ts', () => ({
    redis: { get: async () => null, set: async () => 'OK' },
}));

const { getInstructions, saveInstructions } = await import('../../src/services/instructions/instructions.service.ts');
const { EXTRACTION_VERSION } = await import('../../src/services/instructions/instructions.prompt.ts');

const MODEL = 'claude-haiku-4-5-20251001';
const STEPS = [
    { kind: 'external_application' as const, instruction: 'Apply through Acme careers portal', description: 'https://www.acme.com/jobs/1' },
    { kind: 'other' as const, instruction: 'Email Acme recruiting', description: 'jobs@acme.example' },
];

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describeWithDatabase('instruction storage against Postgres', () => {
    it('stores the header and one row per step, and reads them back in order', async () => {
        await saveInstructions('hash-1', STEPS, MODEL);

        const { rows: [header] } = await db.pool.query(`SELECT model, extracted_at FROM instruction_extractions WHERE description_hash = 'hash-1'`);
        expect(header).toMatchObject({ model: MODEL, extracted_at: expect.any(Date) });

        const { rows } = await db.pool.query(
            `SELECT instruction_id, kind, destination_domain, source, position FROM job_instructions WHERE description_hash = 'hash-1' ORDER BY position`
        );
        expect(rows).toEqual([
            { instruction_id: expect.any(String), kind: 'external_application', destination_domain: 'acme.com', source: 'description', position: 1 },
            { instruction_id: expect.any(String), kind: 'other', destination_domain: 'acme.example', source: 'description', position: 2 },
        ]);

        await expect(getInstructions('hash-1')).resolves.toEqual(STEPS);
    });

    it('stores an empty extraction as a header with no steps, read back as []', async () => {
        await saveInstructions('hash-2', [], MODEL);

        const { rows } = await db.pool.query(`SELECT count(*)::int AS steps FROM job_instructions WHERE description_hash = 'hash-2'`);
        expect(rows[0].steps).toBe(0);
        await expect(getInstructions('hash-2')).resolves.toEqual([]);
    });

    it('returns null for a posting that was never extracted', async () => {
        await expect(getInstructions('hash-unseen')).resolves.toBeNull();
    });

    it('keeps the first write and adds no steps for a second one', async () => {
        await saveInstructions('hash-3', STEPS.slice(0, 1), MODEL);
        await saveInstructions('hash-3', STEPS, MODEL);

        const { rows } = await db.pool.query(`SELECT count(*)::int AS steps FROM job_instructions WHERE description_hash = 'hash-3'`);
        expect(rows[0].steps).toBe(1);
        await expect(getInstructions('hash-3')).resolves.toEqual(STEPS.slice(0, 1));
    });

    it('ignores rows stored under another extraction version', async () => {
        await db.pool.query(
            `INSERT INTO instruction_extractions (description_hash, extraction_version, model) VALUES ('hash-4', $1, $2)`,
            [EXTRACTION_VERSION + 1, MODEL]
        );

        await expect(getInstructions('hash-4')).resolves.toBeNull();
    });

    it('rejects a step without a header', async () => {
        await expect(db.pool.query(
            `INSERT INTO job_instructions (description_hash, extraction_version, kind, instruction, description, source, position)
             VALUES ('hash-5', 1, 'other', 'x', 'y', 'description', 1)`
        )).rejects.toMatchObject({ constraint: 'job_instructions_extraction_fkey' });
    });
});
