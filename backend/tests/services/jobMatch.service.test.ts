import { jest, describe, it, expect, beforeEach } from '@jest/globals';
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
    renderCandidateContext: (context: { profile: { grad_year: number }; resume: { resume_text: string } }) =>
        `GRADUATION YEAR: ${context.profile.grad_year}\nRESUME:\n${context.resume.resume_text}`,
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

const { sendJobDescription, DEFAULT_MATCH_CUTOFF } = await import('../../src/services/jobMatch/jobMatch.service.ts');
const { SCORING_RULES, EXTRACTION_RULES } = await import('../../src/services/jobMatch/jobMatch.prompt.ts');

const COMPANY = 'Acme';
const TITLE = 'Software Engineer';
const DESCRIPTION = 'We are hiring a Software Engineer to build great things.';

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

const lastRequest = () => create.mock.calls[create.mock.calls.length - 1]![0];
const systemText = () => (lastRequest().system as { text: string }[]).map((block) => block.text).join('\n');
const messageText = () => lastRequest().messages.map((m: { content: string }) => m.content).join('\n');

beforeEach(() => {
    query.mockReset();
    create.mockReset();
    getCandidateContext.mockReset();
});

describe('sendJobDescription', () => {
    const analyze = () => sendJobDescription(USER_ID, DESCRIPTION, COMPANY, TITLE);

    const fit = () => aiResponse({ match_score: 80, rationale: 'Good fit.', employer_instructions: [] });

    it('sources the candidate from getCandidateContext without querying the database', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(fit());

        await analyze();

        expect(getCandidateContext).toHaveBeenCalledWith(USER_ID);
        expect(query).not.toHaveBeenCalled();
    });

    it('puts the rules and the rendered candidate in system and the job in messages', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(fit());

        await analyze();

        expect(systemText()).toContain(SCORING_RULES);
        expect(systemText()).toContain(`GRADUATION YEAR: ${GRAD_YEAR}`);
        expect(systemText()).toContain('Backend engineer. Node, Postgres, TypeScript.');
        expect(systemText()).toContain(EXTRACTION_RULES);
        for (const jobDetail of [COMPANY, TITLE, DESCRIPTION]) {
            expect(systemText()).not.toContain(jobDetail);
            expect(messageText()).toContain(jobDetail);
        }
    });

    it('orders system as scoring rules, candidate, extraction rules with one breakpoint at the end', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(fit());

        await analyze();

        const blocks = lastRequest().system as { text: string; cache_control?: unknown }[];
        expect(blocks.map((block) => block.text)).toEqual([
            SCORING_RULES,
            expect.stringContaining('CANDIDATE:'),
            EXTRACTION_RULES,
        ]);
        expect(blocks.map((block) => block.cache_control)).toEqual([undefined, undefined, { type: 'ephemeral' }]);
    });

    it('sends the same system block whatever the job_match sensitivity, and never mentions it', async () => {
        const systemFor = async (job_match: 'low' | 'high') => {
            getCandidateContext.mockResolvedValue(
                candidateContext({ preferences: { ...candidateContext().preferences, job_match } })
            );
            create.mockResolvedValue(fit());
            await analyze();
            return { system: systemText(), messages: messageText() };
        };

        const low = await systemFor('low');
        const high = await systemFor('high');

        expect(low.system).toBe(high.system);
        for (const text of [low.system, low.messages]) {
            expect(text).not.toMatch(/sensitivity|strict|lenient|DO_NOT_APPLY/i);
        }
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
                match_score: 80,
                rationale: 'Good fit.',
                employer_instructions: [
                    { kind: 'external_application', instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
                    { kind: 'external_application', instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
                    { kind: 'other', instruction: 'Disable your ad blocker', description: 'The form needs pop-ups enabled' },
                ],
            })
        );

        const result = await analyze();

        expect(result).toEqual({
            decision: 'APPLY',
            match_score: 80,
            rationale: 'Good fit.',
            employer_instructions: [
                { kind: 'external_application', instruction: 'Apply through Acme portal', description: 'https://acme.example/jobs' },
            ],
        });
    });

    it('keeps cover_letter kinds and turns unknown or missing kinds into other', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(
            aiResponse({
                match_score: 80,
                rationale: 'Good fit.',
                employer_instructions: [
                    { kind: 'cover_letter', instruction: 'Submit a cover letter to Acme', description: 'Required with the application' },
                    { kind: 'assessment', instruction: 'Complete Acme coding test', description: 'https://acme.example/test' },
                    { instruction: 'Email Acme recruiting', description: 'jobs@acme.example' },
                ],
            })
        );

        const result = await analyze();

        expect(result.employer_instructions.map((i: { kind: string }) => i.kind)).toEqual(['cover_letter', 'other', 'other']);
    });

    it('asks Sonnet 5.5 for low effort and schema-constrained output', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(aiResponse({ match_score: 80, rationale: 'Good fit.', employer_instructions: [] }));

        await analyze();

        const request = create.mock.calls[0]![0];
        expect(request.model).toBe('claude-sonnet-5-5');
        expect(request.output_config.effort).toBe('low');
        expect(request.output_config.format.type).toBe('json_schema');
        expect(request.output_config.format.schema.properties.employer_instructions.items.properties.kind.enum)
            .toEqual(['external_application', 'cover_letter', 'other']);
    });

    it('reads the text block when a thinking block comes first', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue({
            content: [
                { type: 'thinking', thinking: '', signature: 'sig' },
                { type: 'text', text: JSON.stringify({ match_score: 30, rationale: 'Different field.', employer_instructions: [] }) },
            ],
        });

        await expect(analyze()).resolves.toEqual({
            decision: 'DO_NOT_APPLY',
            match_score: 30,
            rationale: 'Different field.',
            employer_instructions: [],
        });
    });

    it('throws 502 when the response has no text block', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue({ content: [{ type: 'thinking', thinking: '', signature: 'sig' }] });

        await expect(analyze()).rejects.toMatchObject({ status: 502 });
    });

    it('applies at or above DEFAULT_MATCH_CUTOFF and skips below it', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());

        create.mockResolvedValueOnce(aiResponse({ match_score: DEFAULT_MATCH_CUTOFF, rationale: '', employer_instructions: [] }));
        await expect(analyze()).resolves.toMatchObject({ decision: 'APPLY' });

        create.mockResolvedValueOnce(aiResponse({ match_score: DEFAULT_MATCH_CUTOFF - 1, rationale: '', employer_instructions: [] }));
        await expect(analyze()).resolves.toMatchObject({ decision: 'DO_NOT_APPLY' });
    });

    it.each([[101], [-1], [72.5], ['80'], [null]])('throws 502 for an invalid match score of %p', async (match_score) => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(aiResponse({ match_score, rationale: '', employer_instructions: [] }));

        await expect(analyze()).rejects.toMatchObject({ status: 502, message: 'Invalid match score.' });
    });

    it('throws 502 when the model refuses', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue({ stop_reason: 'refusal', content: [] });

        await expect(analyze()).rejects.toMatchObject({ status: 502 });
    });

    it('constrains match_score to an integer from 0 to 100 in the schema', async () => {
        getCandidateContext.mockResolvedValue(candidateContext());
        create.mockResolvedValue(aiResponse({ match_score: 80, rationale: '', employer_instructions: [] }));

        await analyze();

        expect(create.mock.calls[0]![0].output_config.format.schema.properties.match_score)
            .toEqual({ type: 'integer', minimum: 0, maximum: 100 });
    });
});
