import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import { normalizeAndHash } from '../../utils/hash.ts';
import { getCandidateContext, renderCandidateContext } from '../candidateContext/candidateContext.service.ts';
import { getInstructions, normalizeEmployerInstructions, saveInstructions } from '../instructions/instructions.service.ts';
import { SCORING_VERSION, type JobMatchJob } from './jobMatch.prompt.ts';
import { runJobMatch } from './jobMatch.agent.ts';
import { consumeModelCall } from '../rateLimit/rateLimit.service.ts';

export type JobMatchSensitivity = 'low' | 'medium' | 'high';

/**
 * Minimum match_score to apply, per job_match preference. Applied in code against a stored
 * score, so changing the preference re-reads an existing score instead of buying a new one.
 */
export const MATCH_THRESHOLDS: Record<JobMatchSensitivity, number> = {
  low: 40,
  medium: 55,
  high: 70,
};

/** A score exactly at the threshold passes. An unrecognized preference falls back to medium. */
export const decideFromScore = (match_score: number, job_match: JobMatchSensitivity) =>
  match_score >= (MATCH_THRESHOLDS[job_match] ?? MATCH_THRESHOLDS.medium) ? 'APPLY' : 'DO_NOT_APPLY';

const parseMatchScore = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new AppError(502, 'Invalid match score.');
  }
  return value;
};

/**
 * Looks up a score already bought for this user and job, valid only while the rendered
 * candidate and SCORING_VERSION are unchanged. A lookup failure is logged and treated as a
 * miss, so the request falls through to the model instead of failing.
 */
const checkMatchCache = async (
  user_id: string,
  job: JobMatchJob,
  description_hash: string,
  candidate_hash: string
): Promise<number | null> => {
  try {
    const result = await pool.query(
      `
        SELECT m.match_score
        FROM jobs j
        JOIN job_matches m ON m.job_id = j.job_id
        WHERE j.company = $1 AND j.title = $2 AND j.description_hash = $3
          AND m.user_id::text = $4 AND m.candidate_hash = $5 AND m.scoring_version = $6;
      `,
      [job.company, job.title, description_hash, user_id, candidate_hash, SCORING_VERSION]
    );
    const row = result.rows[0];
    console.log(`[jobMatch] cache ${row ? 'hit' : 'miss'} user=${user_id} description_hash=${description_hash}`);
    return row ? row.match_score : null;
  } catch (error) {
    console.error('[jobMatch] cache read failed, calling the model:', error);
    return null;
  }
};

/**
 * Stores a fresh score so the next request for this user and job is a cache hit. Does
 * nothing when the job row doesn't exist. A write failure is logged and never fails the
 * request, since the score has already been returned to the caller.
 */
const saveMatch = async (
  user_id: string,
  job: JobMatchJob,
  description_hash: string,
  candidate_hash: string,
  match_score: number
) => {
  try {
    await pool.query(
      `
        INSERT INTO job_matches (user_id, job_id, candidate_hash, scoring_version, match_score)
        SELECT $4, job_id, $5, $6, $7
        FROM jobs
        WHERE company = $1 AND title = $2 AND description_hash = $3
        ON CONFLICT (user_id, job_id) DO UPDATE
        SET candidate_hash = EXCLUDED.candidate_hash,
            scoring_version = EXCLUDED.scoring_version,
            match_score = EXCLUDED.match_score,
            created_at = now();
      `,
      [job.company, job.title, description_hash, user_id, candidate_hash, SCORING_VERSION, match_score]
    );
  } catch (error) {
    console.error('[jobMatch] cache write failed:', error);
  }
};

/**
 * Sends a job description to Claude Haiku for a 0-100 match score against the user's
 * resume, and derives APPLY/DO_NOT_APPLY from the user's job_match threshold.
 * The posting's required external steps come from the instruction memo when another request
 * already extracted them; otherwise the same model call extracts them and fills the memo.
 * @param user_id - User evaluating the job
 * @param job_description - Full text of the job posting
 * @param company - Company name for prompt context and instruction formatting
 * @param title - Job title for prompt context
 * @returns Decision, match score, rationale and normalized list of required employer instructions
 */
export const sendJobDescription = async (user_id: string, job_description: string, company: string, title: string) => {
  try {
    const context = await getCandidateContext(user_id).catch((error) => {
      if (error instanceof AppError && error.status === 404) throw new AppError(404, 'Resume not found.');
      throw error;
    });

    const { resume } = context;
    if (!resume?.resume_text) throw new AppError(404, 'Resume not found.');

    const job: JobMatchJob = { company, title, job_description };
    const candidateBlock = renderCandidateContext({ ...context, resume });
    const candidate_hash = normalizeAndHash(candidateBlock);

    const description_hash = normalizeAndHash(job_description);
    const [memoInstructions, cachedScore] = await Promise.all([
      getInstructions(description_hash),
      checkMatchCache(user_id, job, description_hash, candidate_hash),
    ]);
    if (memoInstructions && cachedScore !== null) {
      return {
        decision: decideFromScore(cachedScore, context.preferences.job_match),
        match_score: cachedScore,
        rationale: null,
        employer_instructions: memoInstructions,
      };
    }

    await consumeModelCall(user_id, 'job_match');
    const parsed = await runJobMatch(candidateBlock, job, memoInstructions === null);
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError(502, 'Error with API.');
    }
    const match_score = parseMatchScore(parsed.match_score);
    const employer_instructions = memoInstructions ?? normalizeEmployerInstructions(parsed.employer_instructions);
    await Promise.all([
      memoInstructions ? null : saveInstructions(description_hash, employer_instructions),
      saveMatch(user_id, job, description_hash, candidate_hash, match_score),
    ]);
    return {
      decision: decideFromScore(match_score, context.preferences.job_match),
      match_score,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      employer_instructions,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error processing job description.');
  }
};
