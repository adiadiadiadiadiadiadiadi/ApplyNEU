import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

export const sendJobDescription = async (user_id: string, job_description: string) => {
    try {
        const result = await pool.query(
            `SELECT resume_text FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        )
        const resume = result.rows[0].resume_text
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: 
                `
                You are a job application filter.

                Your task:
                Decide whether the USER should apply to the JOB.

                Rules:
                - Be conservative but practical.
                - If the user meets most core requirements, return APPLY.
                - If clearly unqualified, return DO_NOT_APPLY.
                - Extract ONLY instructions explicitly stated in the job description.
                - Do NOT invent requirements or advice.
                - Output JSON only. No extra text.
                
                Output format:
                {
                  "decision": "APPLY | DO_NOT_APPLY",
                  "employer_instructions": ["..."]
                }
                
                USER PROFILE:
                ${resume}
                
                JOB DESCRIPTION:
                ${job_description}

                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
                `
            }]
        })

        if (!message.content[0] || message.content[0].type !== 'text') {
            return { error: "Error with API." };
        }

        const topics = JSON.parse(message.content[0].text);
        return topics;

    } catch (error) {
        return { error: "Error extracting topics." }
    }
}