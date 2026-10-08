import type Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_RULES, INSTRUCTION_LIST_SCHEMA } from '../instructions/instructions.prompt.ts';

export const JOB_MATCH_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    match_score: { type: 'integer' },
    rationale: { type: 'string' },
    employer_instructions: INSTRUCTION_LIST_SCHEMA,
  },
  required: ['match_score', 'rationale', 'employer_instructions'],
  additionalProperties: false,
};

/** Used when the posting's instructions are already in the memo, so only the score is asked for. */
export const JOB_MATCH_SCORE_ONLY_SCHEMA = {
  type: 'object',
  properties: {
    match_score: JOB_MATCH_OUTPUT_SCHEMA.properties.match_score,
    rationale: JOB_MATCH_OUTPUT_SCHEMA.properties.rationale,
  },
  required: ['match_score', 'rationale'],
  additionalProperties: false,
};

export type JobMatchJob = {
  company: string;
  title: string;
  job_description: string;
};

/**
 * Everything in the system block is the same for every job in a sweep, so it is cached once
 * per user and read back for each posting. Only the job itself goes in messages. The
 * breakpoint after the candidate makes the scoring-only variant, used when the posting's
 * instructions are already in the memo, a cached prefix of the full one.
 */
export const buildSystem = (candidateBlock: string, withExtraction: boolean): Anthropic.TextBlockParam[] => [
  { type: 'text', text: SCORING_RULES },
  { type: 'text', text: `CANDIDATE:\n${candidateBlock}`, cache_control: { type: 'ephemeral' } },
  ...(withExtraction
    ? [{ type: 'text' as const, text: EXTRACTION_RULES, cache_control: { type: 'ephemeral' as const } }]
    : []),
];

export const buildMessages = ({ company, title, job_description }: JobMatchJob): Anthropic.MessageParam[] => [
  {
    role: 'user',
    content: `COMPANY: ${company}\nTITLE: ${title}\n\nJOB DESCRIPTION:\n${job_description}`,
  },
];

/**
 * Stored on every job_matches row; a row scored under a different version is stale. Bump it
 * when a change to SCORING_RULES or the model should invalidate existing scores.
 */
export const SCORING_VERSION = 2;

/**
 * Scoring rules shared by every job in a run. Kept out of renderCandidateContext so that
 * editing this wording does not change candidate_hash and invalidate cached scores; bump
 * SCORING_VERSION when a change should.
 */
export const SCORING_RULES = `
You are a job application scorer. Rate from 0 to 100 how well the JOB suits the CANDIDATE,
and give a one or two sentence rationale. Do not decide whether to apply -- the cutoff is
applied elsewhere.

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

SENIORITY:
- Treat the GRADUATION YEAR as the candidate's seniority. Judge required years/level against it,
  not against the role titles on their resume.
`.trim();
