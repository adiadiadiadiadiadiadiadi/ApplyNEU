import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type EmployerInstruction = { instruction: string; description: string };

const NON_REQUIRED_TASK_PATTERN =
  /\b(ad[\s-]?block(?:er)?|pop[\s-]?up(?: blocker)?|clear (?:your )?cache|cookies?|switch (?:to )?(?:another|different) browser|disable (?:browser )?extensions?|enable javascript|incognito|private mode|vpn|proxy|firewall|antivirus|troubleshoot|workaround|tip|optional|recommended|preference)\b/i;

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

export const sendJobDescription = async (user_id: string, job_description: string) => {
  try {
    const result = await pool.query(
      `SELECT * FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
      [user_id]
    )
    if (!result.rows.length) {
      return { error: 'Resume not found.' };
    }

    const row = result.rows[0];
    const resume = row.short_resume || row.resume_text;
    if (!resume) {
      return { error: 'Short resume not cached.' };
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `
          You are a job application filter. Your task: Decide whether the USER should apply to the JOB.
          
          Rules:
          - Be practical and lean toward APPLY when the user meets a good amount of requirements.
          - If the user reasonably fits the role, return APPLY.
          - Only return DO_NOT_APPLY when clearly unqualified.
          
          EMPLOYER INSTRUCTIONS:
          Extract tasks that are REQUIRED to complete the application, especially actions outside NUWorks.
          Include only explicit must-do actions from the posting.
          
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
          ${resume}
          
          JOB DESCRIPTION:
          ${job_description}
          
          Return ONLY valid JSON. No extra text, whitespace, or markdown.
          `
      }]
    })

    if (!message.content[0] || message.content[0].type !== 'text') {
      return { error: "Error with API." };
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
    return {
      ...parsed,
      employer_instructions: normalizedInstructions
    };

  } catch (error) {
    return { error: "Error extracting topics." }
  }
}

/**
 * Adds job to database and avoids existing jobs.
 * 
 * @param company 
 * @param title 
 * @param description 
 * @returns job in database
 */
export const addJob = async (company: string, title: string, description: string) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO jobs (company, title, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (company, title)
        DO NOTHING
        RETURNING *;
        `,
      [company, title, description]
    );

    if (!result.rows.length) {
      const existing = await pool.query(
        `SELECT * FROM jobs WHERE company = $1 AND title = $2 LIMIT 1;`,
        [company, title]
      );
      if (existing.rows.length) return existing.rows[0];
      return { error: "Job already exists but could not be retrieved." };
    }

    return result.rows[0];
  } catch (error) {
    return { error: "Error extracting topics." }
  }
}
