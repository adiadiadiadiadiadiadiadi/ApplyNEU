import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import { withRetry } from '../../utils/retry.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generateSearchTerms = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT
                r.resume_text,
                p.interests
            FROM resumes r
            JOIN profile p ON p.user_id = r.user_id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 1;
            `,
            [user_id]
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

export const updateSearchTerms = async (user_id: string) => {
    const search_terms = await generateSearchTerms(user_id);

    try {
        const result = await pool.query(
            `
            UPDATE resumes SET search_terms = $1
            WHERE resume_id = 
                (SELECT resume_id FROM resumes 
                WHERE user_id = $2 
                ORDER BY created_at 
                DESC LIMIT 1)
            RETURNING *;
            `,
            [search_terms, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating search terms.');
    }
};

export const cacheShortResume = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT * FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
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
            `
            UPDATE resumes SET short_resume = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [shortened_resume, user_id]
        );
        if (updated.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return updated.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error caching shortened resume.');
    }
};
