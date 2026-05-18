import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "../../utils/retry.ts";
import { AppError } from "../../errors/AppError.ts";
import { NON_REQUIRED_TASK_PATTERN, type EmployerInstruction } from "../../types/tasks.ts";
import { addTask } from "./task.service.ts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Sends raw employer instruction text to Claude Haiku, which extracts only REQUIRED
 * application steps (external portals, assessments, emails). Optional/browser tips are
 * filtered out by both the prompt and NON_REQUIRED_TASK_PATTERN before insertion.
 * Individual task insertion failures are swallowed so one bad row doesn't abort the batch.
 * @param user_id - User the tasks belong to
 * @param employer_instructions - Raw text copied from the job posting
 * @param application_id - Optional application to link tasks to
 * @param company - Company name injected into the AI prompt for context
 * @param title - Job title injected into the AI prompt for context
 * @returns Normalized instruction list and the DB rows that were successfully inserted
 */
export const addInstructions = async (user_id: string, employer_instructions: string, application_id: string, company?: string, title?: string) => {
    try {
        const message = await withRetry(() => anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: `
          Your task: extract REQUIRED application-completion tasks from the provided instructions.

          Provided Instructions:
          ${employer_instructions}

          Company: ${company || 'company unknown'}
          Title: ${title || 'title unknown'}

          IF TWO TASKS HAVE THE SAME PURPOSE, COMBINE THE DESCRIPTIONS INTO ONE TASK.

          INCLUDE ONLY:
          - Required actions needed to complete the application process
          - External steps such as separate portal apply links, required assessments/forms, or required email follow-ups

          NEVER INCLUDE:
          - Optional/recommended advice
          - Generic job-search tips
          - Browser/device settings or troubleshooting instructions
            (ad blocker/pop-up blocker, cache/cookies, switch browser, disable extensions, VPN, incognito, javascript settings)
          - Standard document upload guidance (resume, cover letter, transcript, portfolio, references)

          FORMAT REQUIREMENTS:
          - "instruction" field: Brief action in imperative form (e.g., "Apply through company portal")
          - "description" field: Include URL/email/platform destination when provided; otherwise include concise required details from the instruction text
          - Keep instructions short and action-oriented
          - Include the company name ("${company || 'company unknown'}") in the instruction text when it is known.
          - Always use format: "Action through/at [company]" for instruction, full link in description.
          - Avoid mentioning the actual site the link is on (for example, mention the specific company name
            not generic "company" instead of Workday).

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
            "employer_instructions": [
              {
                "instruction": "...",
                "description": "..."
              },
              ...
            ]
          }

          Return ONLY valid JSON. No extra text, whitespace, or markdown.
          `
            }]
        }));

        if (!message.content[0] || message.content[0].type !== 'text') {
            throw new AppError(502, 'Invalid response from model.');
        }

        const raw = message.content[0].text
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .replace(/`/g, '')
            .trim();

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw new AppError(502, 'Failed to parse employer instructions JSON.');
        }

        const list = Array.isArray(parsed?.employer_instructions) ? parsed.employer_instructions : [];
        const dedup = new Set<string>();
        const normalized = list
            .map((item: any) => {
                if (item && typeof item === 'object') {
                    const instruction = String(item.instruction ?? '').trim();
                    const description = String(item.description ?? '').trim();
                    if (!instruction || !description) return null;

                    /* remove Google ad-blocker text from job description */
                    if (NON_REQUIRED_TASK_PATTERN.test(`${instruction} ${description}`)) return null;
                    
                    const key = `${instruction.toLowerCase()}::${description.toLowerCase()}`;
                    if (dedup.has(key)) return null;
                    dedup.add(key);
                    return { instruction, description };
                }
                return null;
            })
            .filter((v: EmployerInstruction | null): v is EmployerInstruction => !!v);

        const inserted: any[] = [];
        for (const item of normalized) {
            try {
                const res = await addTask(user_id, item.instruction, item.description, application_id);
                inserted.push(res);
            } catch {
                console.error("Could not add task.")
            }
        }

        return { employer_instructions: normalized, tasks: inserted };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error creating tasks from instructions.');
    }
};