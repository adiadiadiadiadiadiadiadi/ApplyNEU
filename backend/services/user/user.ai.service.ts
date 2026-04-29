import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import { withRetry } from '../../utils/retry.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Uses Claude Haiku to generate 10 job-board search terms from the user's resume text
 * and stored interests. Terms are intentionally broad to maximize search results on
 * platforms like NUworks. Results are ordered by relevance priority.
 * @param resume_id - ID of the specific resume to generate terms for
 * @returns Array of up to 10 search term strings
 */
const generateSearchTerms = async (resume_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT
                r.resume_text,
                p.interests
            FROM resumes r
            JOIN profile p ON p.user_id = r.user_id
            WHERE r.resume_id = $1;
            `,
            [resume_id]
        );

        if (!result.rows.length) throw new AppError(404, 'Resume not found.');

        const resumeText: string = result.rows[0].resume_text ?? '';
        const interests: string[] = result.rows[0].interests;
        if (!resumeText) throw new AppError(404, 'Resume text not found.');

        const message = await withRetry(() => anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content:
                    `
                You are analyzing a resume and user interests to extract search terms for jobs the person might be interested in.

                Resume text:
                ${resumeText}

                Interests:
                ${interests.join(', ')}

                Extract and return ONLY a JSON array of 10 relevant search terms:
                The topics should be general, commonly used job title or role keywords, suitable for searching on college job boards like NUworks.
                Order them by priority.
                Make each search term general enough to return enough job results in a search.

                Example format:
                [Software Engineer, Backend Engineer, Full Stack, Application Engineer, Platform Engineer, Data Engineer, DevOps, Cloud Engineer, Software Developer, Technical Engineer]

                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
                `
            }]
        }));

        if (!message.content[0] || message.content[0].type !== 'text') {
            throw new AppError(502, 'Error with API.');
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
            throw new AppError(502, 'Error extracting topics.');
        }

        if (!Array.isArray(parsed)) throw new AppError(502, 'Error extracting topics.');

        const search_terms = parsed
            .map((term: any) => String(term ?? '').trim())
            .filter((term: string) => term.length > 0)
            .slice(0, 10);

        if (!search_terms.length) throw new AppError(502, 'Error extracting topics.');

        return search_terms;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error extracting topics.');
    }
};

/**
 * Persists search terms to the specified resume row.
 * @param resume_id - ID of the resume to store search terms for
 */
export const getSearchTerms = async (resume_id: string) => {
    const search_terms = await generateSearchTerms(resume_id);

    try {
        const result = await pool.query(
            `UPDATE resumes SET search_terms = $1 WHERE resume_id = $2 RETURNING *;`,
            [search_terms, resume_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating search terms.');
    }
};
