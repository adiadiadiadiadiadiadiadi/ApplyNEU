import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

export const addTask = async (user_id: string, text: string, description: string) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO tasks (user_id, text, description)
            VALUES ($1, $2, $3)
            RETURNING *;
            `,
            [user_id, text, description]
        );
        return result.rows[0];

    } catch (error) {
        return { error: "Error creating task." }
    }
}

export const addInstructions = async (user_id: string, employer_instructions: string) => {
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
          - Always use format: "Action through/at [platform]" for instruction, full link in description
          
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
            const res = await addTask(user_id, item.instruction, item.description);
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
        UPDATE tasks SET status = NOT status WHERE task_id = $1
        RETURNING *;
        `,
        [task_id]
    )

    if (result.rows.length === 0) {
        return { error: 'Task not found.' };
    }

    return result.rows[0];
}