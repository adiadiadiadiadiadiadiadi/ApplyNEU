import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import { normalizeAndHash } from '../../utils/hash.ts';
import type { CandidateContextResponse, ResumedCandidateContext } from '../../types/candidateContext.ts';

/**
 * Gathers everything needed to reason about a candidate: their primary resume
 * (falling back to their newest, or null when none has finished uploading), their
 * matching preferences and their profile.
 * @param user_id - ID of the user
 */
export const getCandidateContext = async (user_id: string): Promise<CandidateContextResponse> => {
    try {
        const result = await pool.query(
            `
            SELECT r.resume_id,
                   r.resume_text,
                   r.search_terms,
                   pref.job_match,
                   pref.wait_for_approval,
                   pref.job_types,
                   pref.unpaid_roles,
                   pref.recent_jobs,
                   pref.interests,
                   p.grad_year
            FROM profile p
            JOIN preferences pref ON pref.user_id = p.user_id
            LEFT JOIN LATERAL (
                SELECT resume_id, resume_text, search_terms
                FROM resumes
                WHERE user_id = p.user_id AND upload_complete = true
                ORDER BY (resume_id = pref.primary_resume_id) DESC NULLS LAST, created_at DESC
                LIMIT 1
            ) r ON true
            WHERE p.user_id::text = $1;
            `,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Candidate context not found.');

        const row = result.rows[0];
        return {
            resume: row.resume_id
                ? { resume_text: row.resume_text, search_terms: row.search_terms }
                : null,
            preferences: {
                job_match: row.job_match,
                wait_for_approval: row.wait_for_approval,
                job_types: row.job_types,
                unpaid_roles: row.unpaid_roles,
                recent_jobs: row.recent_jobs,
                interests: row.interests,
            },
            profile: {
                grad_year: row.grad_year,
            },
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching candidate context.');
    }
};

/**
 * Renders the candidate's own signals in a fixed field order so the same profile always
 * produces byte-identical text. Sensitivity and filter preferences are deliberately absent:
 * the score is sensitivity-agnostic and the cutoff is applied in code, so including
 * job_match here would invalidate every cached score whenever the user retunes it.
 */
export const renderCandidateContext = (context: ResumedCandidateContext): string => {
    const { resume, preferences, profile } = context;

    return [
        `GRADUATION YEAR: ${profile.grad_year}`,
        `INTERESTS: ${preferences.interests.join(', ') || 'none specified'}`,
        `RESUME:`,
        resume.resume_text,
    ].join('\n');
};

export const candidateHash = (context: ResumedCandidateContext): string =>
    normalizeAndHash(renderCandidateContext(context));

/**
 * Stored on every job_matches row; a row scored under a different version is stale. Bump it
 * when a change to SCORING_RULES or the model should invalidate existing scores.
 */
export const SCORING_VERSION = 1;

/**
 * Scoring rules shared by every job in a run. Kept out of renderCandidateContext so that
 * editing this wording does not change candidate_hash and invalidate cached scores; bump
 * SCORING_VERSION when a change should.
 */
export const SCORING_RULES = `
You are a job application scorer. Rate from 0 to 100 how well the JOB suits the CANDIDATE.
Return the number only. Do not decide whether to apply -- the cutoff is applied elsewhere.

INTEREST AND DOMAIN FIT:
The candidate's INTERESTS and the field their RESUME is built in define the kind of work they want.
- A role outside that field scores below 20 regardless of how well the candidate meets its
  listed requirements. Transferable or generic skills never lift an unrelated role above it.
- Within the candidate's field, score on how closely the role's requirements match their
  demonstrated experience.

REQUIREMENTS:
- Weigh only concrete, verifiable requirements: named skills, tools, technologies, degrees,
  certifications, domain experience, and required years/level.
- Ignore requirements describing attitude, mentality or disposition, which cannot be verified
  from a resume (e.g. "willing to learn", "passionate", "self-starter", "team player",
  "strong work ethic", "detail-oriented", "eager", "motivated", "fast-paced environment").
  They neither raise nor lower the score.
`.trim();
