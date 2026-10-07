import { AppError } from '../../errors/AppError.ts';
import { getCandidateContext, renderCandidateContext } from '../candidateContext/candidateContext.service.ts';
import { NON_REQUIRED_TASK_PATTERN, type EmployerInstruction } from '../../types/tasks.ts';
import { INSTRUCTION_KINDS } from './jobMatch.prompt.ts';
import { runJobMatch } from './jobMatch.agent.ts';

export type JobMatchSensitivity = 'low' | 'medium' | 'high';

export type InstructionKind = typeof INSTRUCTION_KINDS[number];

export type JobMatchInstruction = EmployerInstruction & { kind: InstructionKind };

/** Applied to every user until #77 maps job_match sensitivity to its own cutoff. */
export const DEFAULT_MATCH_CUTOFF = 50;

const parseMatchScore = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new AppError(502, 'Invalid match score.');
  }
  return value;
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
 * resume, and derives APPLY/DO_NOT_APPLY from DEFAULT_MATCH_CUTOFF.
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

    const parsed = await runJobMatch(
      renderCandidateContext({ ...context, resume }),
      { company, title, job_description }
    );
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError(502, 'Error with API.');
    }
    const match_score = parseMatchScore(parsed.match_score);
    return {
      decision: match_score >= DEFAULT_MATCH_CUTOFF ? 'APPLY' : 'DO_NOT_APPLY',
      match_score,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      employer_instructions: normalizeEmployerInstructions(parsed.employer_instructions),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error processing job description.');
  }
};
