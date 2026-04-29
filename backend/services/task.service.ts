import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors/AppError.ts';
import { withRetry } from '../utils/retry.ts';

type EmployerInstruction = { instruction: string; description: string };

const NON_REQUIRED_TASK_PATTERN =
    /\b(ad[\s-]?block(?:er)?|pop[\s-]?up(?: blocker)?|clear (?:your )?cache|cookies?|switch (?:to )?(?:another|different) browser|disable (?:browser )?extensions?|enable javascript|incognito|private mode|vpn|proxy|firewall|antivirus|troubleshoot|workaround|tip|optional|recommended|preference)\b/i;

/**
 * Inserts a single task for a user, optionally linked to a job application.
 * @param user_id - Owning user ID
 * @param text - Short action label (imperative form)
 * @param description - Detailed description or URL
 * @param application_id - Optional application to associate the task with
 */
export const addTask = async (user_id: string, text: string, description: string, application_id?: string) => {
    try {
        const columns = ['user_id', 'text', 'description'];
        const values: Array<string> = [user_id, text, description];
        const placeholders = ['$1', '$2', '$3'];

        if (application_id) {
            columns.push('application_id');
            values.push(application_id);
            placeholders.push(`$${values.length}`);
        }

        const result = await pool.query(
            `
            INSERT INTO tasks (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *;
            `,
            values
        );
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error creating task.');
    }
};

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
export const addInstructions = async (user_id: string, employer_instructions: string, application_id?: string, company?: string, title?: string) => {
    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
                // skip failed individual task insertions
            }
        }

        return { employer_instructions: normalized, tasks: inserted };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error creating tasks from instructions.');
    }
};

/**
 * Flips a task's completed state. When a task is marked complete, checks whether all
 * remaining tasks for the linked application are done; if so, auto-advances the
 * application status from 'external' to 'applied'. Status promotion errors are swallowed
 * to avoid breaking the toggle response.
 * @param task_id - UUID of the task to toggle
 */
export const toggleTask = async (task_id: string) => {
    try {
        const result = await pool.query(
            `
            UPDATE tasks SET completed = NOT completed WHERE task_id = $1
            RETURNING *;
            `,
            [task_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Task not found.');

        const updated = result.rows[0];

        if (updated.completed && updated.application_id && updated.user_id) {
            try {
                const remaining = await pool.query(
                    `
                    SELECT COUNT(*) AS count
                    FROM tasks
                    WHERE application_id = $1 AND user_id = $2 AND completed = false;
                    `,
                    [updated.application_id, updated.user_id]
                );
                if (Number(remaining.rows?.[0]?.count ?? 0) === 0) {
                    await pool.query(
                        `
                        UPDATE job_applications
                        SET status = 'applied'
                        WHERE application_id = $1 AND user_id = $2 AND status = 'external';
                        `,
                        [updated.application_id, updated.user_id]
                    );
                }
            } catch {
                // swallow to avoid breaking task toggle flow
            }
        }

        return updated;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error toggling task.');
    }
};

/**
 * Fetches all tasks for a user, ordered oldest-first.
 * @param user_id - Owning user ID
 * @param includeCompleted - When true, includes completed tasks; defaults to pending-only
 */
export const getTasks = async (user_id: string, includeCompleted = false) => {
    try {
        const result = await pool.query(
            `
            SELECT text, description, task_id, application_id, completed
            FROM tasks
            WHERE user_id = $1
            ${includeCompleted ? '' : 'AND completed = false'}
            ORDER BY created_at ASC;
            `,
            [user_id]
        );
        return result.rows;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching tasks.');
    }
};

/**
 * Fetches incomplete (pending) tasks for a user across all applications.
 * @param user_id - Owning user ID
 */
export const getCompletedTasksForApplication = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT text, description, task_id, application_id FROM tasks
            WHERE user_id = $1 AND completed = false
            ORDER BY created_at ASC;
            `,
            [user_id]
        );
        return result.rows;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching tasks.');
    }
};

/**
 * Deletes all tasks associated with a specific application for a user.
 * Typically called when an application is removed or reset.
 * @param user_id - Owning user ID (prevents cross-user deletion)
 * @param application_id - Application whose tasks should be deleted
 */
export const deleteTasksForApplication = async (user_id: string, application_id: string) => {
    try {
        await pool.query(
            `DELETE FROM tasks WHERE user_id = $1 AND application_id = $2;`,
            [user_id, application_id]
        );
        return { success: true };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error deleting tasks for application.');
    }
};
