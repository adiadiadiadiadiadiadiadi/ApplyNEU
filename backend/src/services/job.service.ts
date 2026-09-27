import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors/AppError.ts';
import { getCandidateContext } from './candidateContext/candidateContext.service.ts';
import { withRetry } from '../utils/retry.ts';
import { normalizeAndHash } from '../utils/hash.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type EmployerInstruction = { instruction: string; description: string };

export type JobMatchSensitivity = 'low' | 'medium' | 'high';

const NON_REQUIRED_TASK_PATTERN = /\b(ad[\s-]?block(?:er)?|pop[\s-]?up(?: blocker)?|clear (?:your )?cache|cookies?|switch (?:to )?(?:another|different) browser|disable (?:browser )?extensions?|enable javascript|incognito|private mode|vpn|proxy|firewall|antivirus|troubleshoot|workaround|tip|optional|recommended|preference)\b/i;


/**
 * Filters and deduplicates a raw list of employer instruction objects.
 * Strips items that match NON_REQUIRED_TASK_PATTERN (browser tips, optional advice, etc.)
 * and any instruction/description pair that is an exact case-insensitive duplicate.
 */
const normalizeEmployerInstructions = (input: any): EmployerInstruction[] => {
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
      return { instruction, description };
    })
    .filter((v: EmployerInstruction | null): v is EmployerInstruction => !!v);
};

/**
 * Sends a job description to Claude Haiku to decide APPLY/DO_NOT_APPLY using the user's
 * resume text and their job_match sensitivity preference (low/medium/high).
 * Also extracts any required external application steps from the posting.
 * @param user_id - User evaluating the job
 * @param job_description - Full text of the job posting
 * @param company - Company name for prompt context and instruction formatting
 * @param title - Job title for prompt context
 * @returns AI decision and normalized list of required employer instructions
 */
export const sendJobDescription = async (user_id: string, job_description: string, company: string, title: string) => {
  try {
    const context = await getCandidateContext(user_id).catch((error) => {
      if (error instanceof AppError && error.status === 404) throw new AppError(404, 'Resume not found.');
      throw error;
    });

    const resume = context.resume.resume_text;
    if (!resume) throw new AppError(404, 'Resume not found.');

    const gradYear = context.profile.grad_year;
    const jobMatchRaw = (context.preferences.job_match ?? 'medium').toString().toLowerCase();
    const jobMatchSensitivity: JobMatchSensitivity =
      jobMatchRaw === 'high' ? 'high' : jobMatchRaw === 'low' ? 'low' : 'medium';

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `
          You are a job application filter. Your task: Decide whether the USER should apply to the JOB.

          COMPANY: ${company}
          TITLE: ${title}

          CANDIDATE GRADUATION YEAR: ${gradYear}
          - Treat the graduation year as the candidate's seniority: it is the authoritative signal,
            so do not infer their level from the role titles on their resume.

          MATCH SENSITIVITY: ${jobMatchSensitivity.toUpperCase()}
          - LOW (not strict): Be lenient and favor APPLY if the resume plausibly covers several required skills/responsibilities; only DO_NOT_APPLY for clear mismatches.
          - MEDIUM (pretty strict): Balanced judgment (default). Apply when the user meets a good amount of requirements; DO_NOT_APPLY when clearly unqualified.
          - HIGH (VERY STRICT): Require strong alignment to required skills, tech stack, responsibilities, domain, and experience level. If missing key required skills/years/domain fit, choose DO_NOT_APPLY.
          Apply the ${jobMatchSensitivity.toUpperCase()} rules above when making the decision.

          Rules:
          - Extract the job description's explicit requirements: skills, tools/tech stack, responsibilities, and required years/level.
          - Compare those requirements to the user's resume. Focus on REQUIRED skills/tech/tools and must-have experience.
          - Judge any required years/level against the graduation year above rather than against resume job titles.
          - Be practical and lean toward APPLY when the user meets a good amount of required skills/responsibilities (use sensitivity rules above).
          - If the user reasonably fits the required skills/responsibilities, return APPLY.
          - When the resume misses key REQUIRED skills/tech/experience from the job description, choose DO_NOT_APPLY (stricter if sensitivity is HIGH).

          EMPLOYER INSTRUCTIONS:
          Extract tasks that are REQUIRED to complete the application, especially actions outside NUWorks.
          Include only explicit must-do actions from the posting.
          Always include the company name ("${company}") in the instruction text when present.

          NEVER include:
          - Resume / cover letter / transcript / portfolio / references upload instructions
          - Generic advice (research company, tailor resume, follow up, networking, etc.)
          - Optional/preferred/recommended tips
          - Browser/device troubleshooting or settings steps
            (ad blocker/pop-up blocker, clear cache/cookies, switch browsers, disable extensions,
             incognito/private mode, VPN/proxy, firewall/antivirus, javascript settings)

          ONLY include required actions such as:
          - Apply through a separate company portal/site
          - Complete a required external assessment or questionnaire
          - Email required information/materials to a specific address
          - Register/schedule/confirm a required step on another platform

          If no required extra steps exist beyond NUWorks, return an empty array.

          FORMAT REQUIREMENTS:
          - "instruction" field: Brief action in imperative form (e.g., "Apply through company portal")
          - "description" field: Include the exact URL/email/platform destination when provided; otherwise include concise required details from the posting
          - Keep instructions short and action-oriented
          - Prefer format: "Action through/at [platform]" for instruction
          - Make sure the instruction is accurate to the link (e.g. https://ats.rippling.com/tive-careers is for Tive, not Rippling).

          Examples:
          {
            "instruction": "Apply through Garmin careers portal",
            "description": "https://careers.garmin.com/jobs/12345"
          }
          {
            "instruction": "Email hiring manager",
            "description": "jobs@company.com"
          }
          {
            "instruction": "Complete coding assessment",
            "description": "https://assessment.company.com/test"
          }

          If there are no external/additional steps beyond completing the NUWorks form, return an empty array.

          Output format (JSON only, no markdown):
          {
            "decision": "APPLY | DO_NOT_APPLY",
            "employer_instructions": [
              {
                "instruction": "...",
                "description": "..."
              },
              ...
            ]
          }

          USER PROFILE:
          GRADUATION YEAR: ${gradYear}
          ${resume}

          JOB DESCRIPTION:
          ${job_description}

          Return ONLY valid JSON. No extra text, whitespace, or markdown.
          `
      }]
    }));

    if (!message.content[0] || message.content[0].type !== 'text') {
      throw new AppError(502, 'Error with API.');
    }

    const raw = message.content[0].text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/`/g, '')
      .trim();
    const parsed = JSON.parse(raw);
    const normalizedInstructions = normalizeEmployerInstructions(parsed?.employer_instructions);
    if (!parsed || typeof parsed !== 'object') {
      return { decision: 'DO_NOT_APPLY', employer_instructions: normalizedInstructions };
    }
    return { ...parsed, employer_instructions: normalizedInstructions };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error processing job description.');
  }
};

/**
 * Inserts a job, deduplicating on (company, title, description_hash) so that a repost
 * with a changed description becomes a new job_id rather than mutating the existing row.
 * A conflict therefore means the description is byte-identical after normalization, which
 * makes the DO UPDATE a no-op kept only so RETURNING yields the existing row.
 * @param company - Company name
 * @param title - Job title
 * @param description - Full job description text
 */
export const addJob = async (company: string, title: string, description: string) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO jobs (company, title, description, description_hash)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company, title, description_hash)
        DO UPDATE SET description = EXCLUDED.description
        RETURNING *;
      `,
      [company, title, description, normalizeAndHash(description)]
    );
    if (!result.rows[0]) throw new AppError(500, 'Error creating job.');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error creating job.');
  }
};