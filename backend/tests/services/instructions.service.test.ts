import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const query = jest.fn<(text: string, params?: any[]) => Promise<any>>();

jest.unstable_mockModule('../../src/db/index.ts', () => ({
    pool: { query },
}));

const { getInstructions, saveInstructions } = await import('../../src/services/instructions/instructions.service.ts');
const { EXTRACTION_VERSION } = await import('../../src/services/instructions/instructions.prompt.ts');

const HASH = 'abc123';
const INSTRUCTIONS = [
    { kind: 'external_application' as const, instruction: 'Apply through Acme careers portal', description: 'https://acme.com/jobs/1' },
];

const lastCall = () => query.mock.calls[query.mock.calls.length - 1]!;

beforeEach(() => {
    query.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getInstructions', () => {
    it('looks up the posting hash under the current extraction version', async () => {
        query.mockResolvedValue({ rows: [] });

        await getInstructions(HASH);

        const [text, params] = lastCall();
        expect(text).toContain('FROM instruction_extractions');
        expect(params).toEqual([HASH, EXTRACTION_VERSION]);
    });

    it('returns null when the posting has not been extracted', async () => {
        query.mockResolvedValue({ rows: [] });

        await expect(getInstructions(HASH)).resolves.toBeNull();
    });

    it('returns the stored instructions on a hit', async () => {
        query.mockResolvedValue({ rows: [{ instructions: INSTRUCTIONS }] });

        await expect(getInstructions(HASH)).resolves.toEqual(INSTRUCTIONS);
    });

    it('returns an empty array, not null, for a posting that requires nothing', async () => {
        query.mockResolvedValue({ rows: [{ instructions: [] }] });

        await expect(getInstructions(HASH)).resolves.toEqual([]);
    });

    it('treats a read failure as a miss', async () => {
        query.mockRejectedValue(new Error('connection lost'));

        await expect(getInstructions(HASH)).resolves.toBeNull();
    });
});

describe('saveInstructions', () => {
    it('inserts under the current extraction version and keeps the first write', async () => {
        query.mockResolvedValue({ rows: [] });

        await saveInstructions(HASH, INSTRUCTIONS);

        const [text, params] = lastCall();
        expect(text).toContain('INSERT INTO instruction_extractions');
        expect(text).toContain('ON CONFLICT (description_hash, extraction_version) DO NOTHING');
        expect(params).toEqual([HASH, EXTRACTION_VERSION, JSON.stringify(INSTRUCTIONS)]);
    });

    it('stores an empty extraction as an empty array', async () => {
        query.mockResolvedValue({ rows: [] });

        await saveInstructions(HASH, []);

        expect(lastCall()[1]![2]).toBe('[]');
    });

    it('does not throw when the write fails', async () => {
        query.mockRejectedValue(new Error('connection lost'));

        await expect(saveInstructions(HASH, INSTRUCTIONS)).resolves.toBeUndefined();
    });
});
