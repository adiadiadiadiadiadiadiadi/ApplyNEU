import { describe, it, expect } from '@jest/globals';
import { renderCandidateContext, candidateHash } from '../../src/services/candidateContext/candidateContext.service.ts';
import type { CandidateContextResponse } from '../../src/types/candidateContext.ts';

const profile = (): CandidateContextResponse => ({
    resume: {
        resume_text: 'Backend engineer. Node, Postgres, TypeScript.',
        search_terms: ['backend', 'platform'],
        interests: ['distributed systems'],
    },
    preferences: {
        job_match: 'low',
        wait_for_approval: true,
        job_types: ['co-op', 'internship'],
        unpaid_roles: false,
        recent_jobs: true,
    },
    profile: { grad_year: 2027 },
});

describe('renderCandidateContext', () => {
    it('renders byte-identical output for identical input', () => {
        expect(renderCandidateContext(profile())).toBe(renderCandidateContext(profile()));
    });

    it('omits sensitivity and filter preferences', () => {
        const rendered = renderCandidateContext(profile());
        expect(rendered).not.toMatch(/job_match|sensitivity|unpaid|recent/i);
        expect(rendered).not.toContain('low');
    });

    it('omits job types, interests and search terms', () => {
        const rendered = renderCandidateContext(profile());
        expect(rendered).not.toMatch(/DESIRED JOB TYPES|INTERESTS|SEARCH TERMS/);
        expect(rendered).not.toMatch(/co-op|internship|distributed systems|platform/);
    });
});

describe('candidateHash', () => {
    it('does not change when job_match changes', () => {
        const low = profile();
        const high: CandidateContextResponse = {
            ...low,
            preferences: { ...low.preferences, job_match: 'high' },
        };
        expect(candidateHash(high)).toBe(candidateHash(low));
    });

    it('does not change when interests, search terms or job types change', () => {
        const base = profile();
        const changed: CandidateContextResponse = {
            ...base,
            resume: { ...base.resume, interests: ['compilers'], search_terms: ['frontend'] },
            preferences: { ...base.preferences, job_types: ['full-time'] },
        };
        expect(candidateHash(changed)).toBe(candidateHash(base));
    });

    it('changes when the resume changes', () => {
        const base = profile();
        const changed: CandidateContextResponse = {
            ...base,
            resume: { ...base.resume, resume_text: 'Frontend engineer. React.' },
        };
        expect(candidateHash(changed)).not.toBe(candidateHash(base));
    });
});
