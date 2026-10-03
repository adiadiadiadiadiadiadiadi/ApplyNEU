import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { normalizeAndHash } from '../../src/utils/hash.ts';
import { AppError } from '../../src/errors/AppError.ts';
import type { CandidateContextResponse } from '../../src/types/candidateContext.ts';

const query = jest.fn<(text: string, params?: any[]) => Promise<any>>();
const create = jest.fn<(args: any) => Promise<any>>();
const getCandidateContext = jest.fn<(user_id: string) => Promise<CandidateContextResponse>>();

jest.unstable_mockModule('../../src/db/index.ts', () => ({
    pool: { query },
}));

jest.unstable_mockModule('../../src/services/candidateContext/candidateContext.service.ts', () => ({
    getCandidateContext,
}));

class TransientError extends Error {}

jest.unstable_mockModule('@anthropic-ai/sdk', () => {
    class Anthropic {
        messages = { create };
        static APIConnectionError = TransientError;
        static RateLimitError = TransientError;
        static InternalServerError = TransientError;
    }
    return { default: Anthropic };
});

const { addJob, sendJobDescription } = await import('../../src/services/job.service.ts');

const COMPANY = 'Acme';
const TITLE = 'Software Engineer';
const DESCRIPTION = 'We are hiring a Software Engineer to build great things.';

const jobRow = (job_id: string, description: string) => ({
    rows: [{ job_id, company: COMPANY, title: TITLE, description, description_hash: normalizeAndHash(description) }],
});

const lastCall = () => query.mock.calls[query.mock.calls.length - 1]!;

const USER_ID = 'user-1';
const GRAD_YEAR = 2027;

const candidateContext = (
    overrides: Partial<CandidateContextResponse> = {}
): CandidateContextResponse => ({
    resume: {
        resume_text: 'Backend engineer. Node, Postgres, TypeScript.',
        search_terms: ['backend'],
    },
    preferences: {
        job_match: 'high',
        wait_for_approval: true,
        job_types: ['co-op'],
        unpaid_roles: false,
        recent_jobs: true,
        interests: ['distributed systems'],
    },
    profile: { grad_year: GRAD_YEAR },
    ...overrides,
});

const aiResponse = (payload: unknown) => ({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
});

const renderedPrompt = () => create.mock.calls[0]![0].messages[0].content as string;

beforeEach(() => {
    query.mockReset();
    create.mockReset();
    getCandidateContext.mockReset();
});

describe('sendJobDescription', () => {
    const analyze = () => sendJobDescription(USER_ID, DESCRIPTION, COMPANY, TITLE);

    it('sources the resume and sensitivity from getCandidateContext without querying the database', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(aiResponse({ decision: 'APPLY', employer_instructions: [] }));

        await analyze();

        expect(getCandidateContext).toHaveBeenCalledWith(USER_ID);
        expect(query).not.toHaveBeenCalled();
        expect(renderedPrompt()).toContain('MATCH SENSITIVITY: HIGH');
    });

    it('renders the graduation year into the prompt', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(aiResponse({ decision: 'APPLY', employer_instructions: [] }));

        await analyze();

        expect(renderedPrompt()).toContain(String(GRAD_YEAR));
    });

    it('defaults to medium sensitivity when job_match is absent', async () => {
        getCandidateContext.mockResolvedValue(
            candidateContext({
                preferences: {
                    job_match: undefined as any,
                    wait_for_approval: true,
                    job_types: [],
                    unpaid_roles: false,
                    recent_jobs: false,
                    interests: ['distributed systems'],
                },
            })
        );
        create.mockResolvedValue(aiResponse({ decision: 'APPLY', employer_instructions: [] }));

        await analyze();

        expect(renderedPrompt()).toContain('MATCH SENSITIVITY: MEDIUM');
    });

    it('throws 404 Resume not found when the candidate has no context', async () => {
        getCandidateContext.mockRejectedValue(new AppError(404, 'Candidate context not found.'));

        await expect(analyze()).rejects.toMatchObject({ status: 404, message: 'Resume not found.' });
        expect(create).not.toHaveBeenCalled();
    });

    it('throws 404 Resume not found when the candidate has no resume', async () => {
        getCandidateContext.mockResolvedValue(candidateContext({ resume: null }));

        await expect(analyze()).rejects.toMatchObject({ status: 404, message: 'Resume not found.' });
        expect(create).not.toHaveBeenCalled();
    });

    it('throws 404 Resume not found when the resume text is empty', async () => {
        getCandidateContext.mockResolvedValue(
            candidateContext({ resume: { resume_text: '', search_terms: [] } })
        );

        await expect(analyze()).rejects.toMatchObject({ status: 404, message: 'Resume not found.' });
        expect(create).not.toHaveBeenCalled();
    });

    it('propagates a non-404 candidate context failure as a 500', async () => {
        getCandidateContext.mockRejectedValue(new AppError(500, 'Error fetching candidate context.'));

        await expect(analyze()).rejects.toMatchObject({ status: 500 });
    });

    it('normalizes the employer instructions returned by the model', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(
            aiResponse({
                decision: 'APPLY',
                employer_instructions: [
                    { instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
                    { instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
                    { instruction: 'Disable your ad blocker', description: 'The form needs pop-ups enabled' },
                ],
            })
        );

        const result = await analyze();

        expect(result).toEqual({
            decision: 'APPLY',
            employer_instructions: [
                { instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
            ],
        });
    });
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
