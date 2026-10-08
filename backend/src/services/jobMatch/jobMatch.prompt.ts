import type Anthropic from '@anthropic-ai/sdk';

export const INSTRUCTION_KINDS = ['external_application', 'cover_letter', 'other'] as const;

export const JOB_MATCH_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    match_score: { type: 'integer' },
    rationale: { type: 'string' },
    employer_instructions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...INSTRUCTION_KINDS] },
          instruction: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['kind', 'instruction', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['match_score', 'rationale', 'employer_instructions'],
  additionalProperties: false,
};

export type JobMatchJob = {
  company: string;
  title: string;
  job_description: string;
};

/**
 * Required application steps, extracted from the posting alongside the score. Last in the
 * system block so a scoring-only variant (#73) is an exact prefix of this one.
 */
export const EXTRACTION_RULES = `
EMPLOYER INSTRUCTIONS:
Also extract the steps the posting says are REQUIRED to complete the application,
especially actions outside NUWorks. Include only explicit must-do actions.
Always include the COMPANY name in the instruction text.

NEVER include:
- Resume / transcript / portfolio / references upload instructions
- Optional cover letters (a REQUIRED cover letter is the one upload to include)
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
- Submit a required cover letter

If nothing is required beyond the NUWorks form, return an empty array.

FIELDS:
- "kind": "external_application" when the step is applying on a separate company portal/site,
  "cover_letter" when a cover letter is required, "other" for everything else
- "instruction": brief imperative action, e.g. "Apply through Garmin careers portal"
- "description": the exact URL, email or platform when given; otherwise the concise required
  details from the posting
- Make sure the instruction matches the link's owner (e.g. https://ats.rippling.com/tive-careers
  is for Tive, not Rippling).
`.trim();

/**
 * Everything in the system block is the same for every job in a sweep, so it is cached once
 * per user and read back for each posting. Only the job itself goes in messages.
 */
export const buildSystem = (candidateBlock: string): Anthropic.TextBlockParam[] => [
  { type: 'text', text: SCORING_RULES },
  { type: 'text', text: `CANDIDATE:\n${candidateBlock}` },
  { type: 'text', text: EXTRACTION_RULES, cache_control: { type: 'ephemeral' } },
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
