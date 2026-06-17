import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../../db/index.ts";
import { AppError } from "../../errors/AppError.ts";
import { withRetry } from "../../utils/retry.ts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Compresses a resume's full text into a structured JSON summary (skills,
 * role_titles, seniority_level, domains) and stores it as short_resume on the resume row.
 * This cached summary is what sendJobDescription reads for fast AI job matching —
 * avoids sending the full resume text on every job evaluation.
 * @param resume_id - ID of the specific resume to summarize and cache
 */
export const cacheShortResume = async (resume_id: string) => {
    try {
        const result = await pool.query(
            `SELECT * FROM resumes WHERE resume_id = $1;`,
            [resume_id]
        );
        if (!result.rows.length) throw new AppError(404, 'Resume not found.');
        const resumeText = result.rows[0].resume_text;

        const message = await withRetry(() => anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content:
                    `
                You are summarizing a resume for automated job matching.

                Rules:
                - Extract only factual information explicitly stated in the resume
                - Do NOT infer or guess
                - Do NOT include placeholders like "unknown"
                - No fluff, opinions, formatting, or markdown
                - Keep under 250 tokens

                If seniority level is not explicitly stated, infer it using role titles:
                    - Intern → Entry-level
                    - New Graduate / Junior → Entry-level
                    - Software Engineer → Mid-level
                    - Senior / Lead / Staff → Senior-level
                    - Founder / Co-founder only does NOT imply seniority

                Return ONLY the following JSON fields:
                - skills: array of strings containing ONLY skills explicitly mentioned
                - role_titles: array of strings
                - seniority_level: string (empty if not stated)
                - domains: array of strings

                If a field has no data, return an empty array or empty string.

                RESUME:
                ${resumeText}

                This is NOT markdown.
                Return ONLY the JSON of information, nothing else. There should be no extra whitespace, punctuation, or markdown characters.
                `
            }]
        }));

        if (!message.content[0] || message.content[0].type !== 'text') {
            throw new AppError(502, 'Error with API.');
        }

        const shortened_resume = JSON.parse(
            message.content[0].text
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/`/g, '')
                .trim()
        );

        const updated = await pool.query(
            `UPDATE resumes SET short_resume = $1 WHERE resume_id = $2 RETURNING *;`,
            [shortened_resume, resume_id]
        );
        if (updated.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return updated.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error caching shortened resume.');
    }
};