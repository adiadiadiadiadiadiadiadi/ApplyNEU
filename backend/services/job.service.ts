import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

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
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
          Extract ONLY additional steps required OUTSIDE the NUWorks application system.
          
          NEVER include instructions about:
          - Resume (uploading, submitting, attaching)
          - Cover letter (uploading, writing, submitting, attaching)
          - Transcript (uploading, submitting)
          - Portfolio (uploading, submitting, linking)
          - References (providing, listing)
          - Any document upload mentioned in the job description
          
          ONLY include if the job explicitly requires you to:
          - Apply on a separate company website/portal (with URL)
          - Email someone directly (with email address)
          - Complete an external assessment/form (with URL)
          - Take action on a platform OTHER than NUWorks
          
          If the instruction mentions "upload", "submit a document", "attach", or "provide" - IGNORE IT.
          If the instruction is about standard application materials - IGNORE IT.
          
          FORMAT REQUIREMENTS:
          - "instruction" field: Brief action in imperative form (e.g., "Apply through company portal")
          - "description" field: MUST include the full URL or email address
          - Keep instructions short and action-oriented
          - Always use format: "Action through/at [platform]" for instruction, full link in description
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
        const topics = JSON.parse(raw);
        return topics;

    } catch (error) {
        return { error: "Error extracting topics." }
    }
}

