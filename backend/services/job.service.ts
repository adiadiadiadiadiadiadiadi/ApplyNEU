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
                content: 
                `
                You are a job application filter.

                Your task:
                Decide whether the USER should apply to the JOB.

                Rules:
                - Be practical and lean toward APPLY when the user meets a good amount of requirements.
                - If the user reasonably fits the role, return APPLY.
                - Only return DO_NOT_APPLY when clearly unqualified.
                - Extract ONLY instructions explicitly stated in the job description.
                - Instructions are things to do immediately after applying to complete the application, like "Apply to <some company>" or "Email <some email>.
                    - This does not mean relocation, it just means tasks to finish the application. 
                - The description would contain any relevant links, like the company's website or any other relevant instructions.
                - How NUWorks is users submit some documents like a resume, cover letter, portfolio, etc and submit, but 
                  the company usually gives some extra instructions like to apply on their website or to email somebody.
                - Do not give instructions with resume, cover letter, portfolio, etc. or other things in the NUWorks application.
                  Those are not your responsibility.
                - If there are none, leave the array empty for employer instructions. 
                - You may summarize instructions, but include any relevant links with it.
                - Do NOT invent requirements or advice.
                - Each instruction should be a few words, excluding the link/email.
                - Output JSON only. No extra text.
                
                Output format:
                {
                  "decision": "APPLY | DO_NOT_APPLY",
                  "employer_instructions": {
                    "instruction": ...
                    "description": ...
                  }
                }
                
                USER PROFILE:
                ${resume}
                
                JOB DESCRIPTION:
                ${job_description}

                DO NOT INCLUDE ANY MARKDOWN PUNCTUATION, THIS JSON WILL BE PARSED.
                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
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