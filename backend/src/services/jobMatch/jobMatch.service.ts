import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import { normalizeAndHash } from '../../utils/hash.ts';
import { getCandidateContext, renderCandidateContext } from '../candidateContext/candidateContext.service.ts';
import { NON_REQUIRED_TASK_PATTERN, type EmployerInstruction } from '../../types/tasks.ts';
import { INSTRUCTION_KINDS, SCORING_VERSION, type JobMatchJob } from './jobMatch.prompt.ts';
import { runJobMatch } from './jobMatch.agent.ts';

export type JobMatchSensitivity = 'low' | 'medium' | 'high';

export type InstructionKind = typeof INSTRUCTION_KINDS[number];

export type JobMatchInstruction = EmployerInstruction & { kind: InstructionKind };

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

type CachedMatch = { match_score: number; employer_instructions: JobMatchInstruction[] };

/**
 * Looks up a score already bought for this user and job, valid only while the rendered
 * candidate and SCORING_VERSION are unchanged. Instructions come from the job row, since they
 * depend on the posting alone. A lookup failure is logged and treated as a miss, so the
 * request falls through to the model instead of failing.
 */
const checkMatchCache = async (user_id: string, job: JobMatchJob, candidate_hash: string): Promise<CachedMatch | null> => {
  const description_hash = normalizeAndHash(job.job_description);
  try {
    const result = await pool.query(
      `
        SELECT m.match_score, j.employer_instructions
        FROM jobs j
        JOIN job_matches m ON m.job_id = j.job_id
        WHERE j.company = $1 AND j.title = $2 AND j.description_hash = $3
          AND m.user_id::text = $4 AND m.candidate_hash = $5 AND m.scoring_version = $6
          AND j.employer_instructions IS NOT NULL;
      `,
      [job.company, job.title, description_hash, user_id, candidate_hash, SCORING_VERSION]
    );
    const row = result.rows[0];
    console.log(`[jobMatch] cache ${row ? 'hit' : 'miss'} user=${user_id} description_hash=${description_hash}`);
    if (!row) return null;
    return {
      match_score: row.match_score,
      employer_instructions: normalizeEmployerInstructions(row.employer_instructions),
    };
  } catch (error) {
    console.error('[jobMatch] cache read failed, calling the model:', error);
    return null;
  }
};

/**
 * Stores a fresh score and the posting's instructions so the next request for this job is a
 * cache hit. Does nothing when the job row doesn't exist. A write failure is logged and never
 * fails the request, since the score has already been returned to the caller.
 */
const saveMatch = async (
  user_id: string,
  job: JobMatchJob,
  candidate_hash: string,
  match_score: number,
  employer_instructions: JobMatchInstruction[]
) => {
  try {
    await pool.query(
      `
        WITH job AS (
          UPDATE jobs SET employer_instructions = $4
          WHERE company = $1 AND title = $2 AND description_hash = $3
          RETURNING job_id
        )
        INSERT INTO job_matches (user_id, job_id, candidate_hash, scoring_version, match_score)
        SELECT $5, job_id, $6, $7, $8 FROM job
        ON CONFLICT (user_id, job_id) DO UPDATE
        SET candidate_hash = EXCLUDED.candidate_hash,
            scoring_version = EXCLUDED.scoring_version,
            match_score = EXCLUDED.match_score,
            created_at = now();
      `,
      [
        job.company, job.title, normalizeAndHash(job.job_description), JSON.stringify(employer_instructions),
        user_id, candidate_hash, SCORING_VERSION, match_score,
      ]
    );
  } catch (error) {
    console.error('[jobMatch] cache write failed:', error);
  }
};

/**
 * Filters and deduplicates a raw list of employer instruction objects.
 * Strips items that match NON_REQUIRED_TASK_PATTERN (browser tips, optional advice, etc.)
 * and any instruction/description pair that is an exact case-insensitive duplicate.
 * An unrecognized kind becomes 'other'.
 */
const normalizeEmployerInstructions = (input: any): JobMatchInstruction[] => {
  if (!Array.isArray(input)) return [];

  const dedup = new Set<string>();
  return input
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const instruction = String(item.instruction ?? '').trim();
      const description = String(item.description ?? '').trim();
      if (!instruction || !description) return null;
      if (NON_REQUIRED_TASK_PATTERN.test(`${instruction} ${description}`)) return null;
      const key = `${instruction.toLowerCase()}::${description.toLowerCase()}`;
      if (dedup.has(key)) return null;
      dedup.add(key);
      const kind: InstructionKind = INSTRUCTION_KINDS.includes(item.kind) ? item.kind : 'other';
      return { kind, instruction, description };
    })
    .filter((v: JobMatchInstruction | null): v is JobMatchInstruction => !!v);
};

/**
 * Sends a job description to Claude Sonnet for a 0-100 match score against the user's
 * resume, and derives APPLY/DO_NOT_APPLY from the user's job_match threshold.
 * Also extracts any required external application steps from the posting.
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

    const cached = await checkMatchCache(user_id, job, candidate_hash);
    if (cached) {
      return {
        decision: decideFromScore(cached.match_score, context.preferences.job_match),
        match_score: cached.match_score,
        rationale: null,
        employer_instructions: cached.employer_instructions,
      };
    }

    const parsed = await runJobMatch(candidateBlock, job);
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError(502, 'Error with API.');
    }
    const match_score = parseMatchScore(parsed.match_score);
    const employer_instructions = normalizeEmployerInstructions(parsed.employer_instructions);
    await saveMatch(user_id, job, candidate_hash, match_score, employer_instructions);
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
