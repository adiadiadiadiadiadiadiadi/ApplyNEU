import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

export const addTask = async (user_id: string, text: string, description: string, application_id?: string) => {
    try {
        const columns = ['user_id', 'text', 'description'];
        const values: Array<string> = [user_id, text, description];
        const placeholders = ['$', '1', ', ', '$', '2', ', ', '$', '3'];

        if (application_id) {
            columns.push('application_id');
            values.push(application_id);
            placeholders.push(', ', '$', (values.length).toString());
        }

        const result = await pool.query(
            `
            INSERT INTO tasks (${columns.join(', ')})
            VALUES (${placeholders.join('')})
            RETURNING *;
            `,
            values
        );
        return result.rows[0];

    } catch (error) {
        return { error: "Error creating task." }
    }
}

export const addInstructions = async (user_id: string, employer_instructions: string, application_id?: string) => {
    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: `
          Your task: format job instructions to display to users.
          
          Provided Instructions:
          ${employer_instructions}
          
          FORMAT REQUIREMENTS:
          - "instruction" field: Brief action in imperative form (e.g., "Apply through company portal")
          - "description" field: MUST include the full URL or email address
          - Keep instructions short and action-oriented
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
        })

        if (!message.content[0] || message.content[0].type !== 'text') {
            return { error: 'Invalid response from model.' }
        }

        const raw = message.content[0].text
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .replace(/`/g, '')
            .trim();

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            return { error: 'Failed to parse employer instructions JSON.' }
        }

        const list = Array.isArray(parsed?.employer_instructions) ? parsed.employer_instructions : [];
        const normalized = list
            .map((item: any) => {
                if (item && typeof item === 'object') {
                    const instruction = String(item.instruction ?? '').trim();
                    const description = String(item.description ?? '').trim();
                    if (!instruction || !description) return null;
                    return { instruction, description };
                }
                return null;
            })
            .filter((v: any) => !!v);

        const inserted: any[] = [];
        for (const item of normalized) {
            const res = await addTask(user_id, item.instruction, item.description, application_id);
            if (!('error' in res)) {
                inserted.push(res);
            }
        }

        return { employer_instructions: normalized, tasks: inserted };

    } catch (error) {
        return { error: "Error creating task." }
    }
}

export const toggleTask = async (task_id: string) => {
    const result = await pool.query(
        `
        UPDATE tasks SET completed = NOT completed WHERE task_id = $1
        RETURNING *;
        `,
        [task_id]
    )

    if (result.rows.length === 0) {
        return { error: 'Task not found.' };
    }

    return result.rows[0];
}

export const getTasks = async (user_id: string) => {
  const result = await pool.query(
      `
      SELECT text, task_id, application_id, completed
      FROM tasks
      WHERE user_id = $1 AND completed = false
      ORDER BY created_at ASC;
      `,
      [user_id]
  )

  return result.rows;
}

export const getCompletedTasksForApplication = async (user_id: string) => {
    const result = await pool.query(
        `
        SELECT text, task_id, application_id FROM tasks WHERE user_id = $1 AND completed = false
        ORDER BY created_at ASC;
        `,
        [user_id]
    )
  
    return result.rows;
  }

export const deleteTasksForApplication = async (user_id: string, application_id: string) => {
    try {
        await pool.query(
            `
            DELETE FROM tasks
            WHERE user_id = $1 AND application_id = $2;
            `,
            [user_id, application_id]
        );
        return { success: true };
    } catch (error) {
        return { error: 'Error deleting tasks for application.' };
    }
}