import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

export const addUser = async (user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO users (user_id, first_name, last_name, email, grad_year)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
            `,
            [user_id, first_name, last_name, email, grad_year]
        )
        return result.rows[0]
    } catch (error) {
        return { error: 'Error adding user.' }
    }
};

export const getJobType = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT job_types FROM users WHERE user_id = $1;
            `,
            [user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error getting job types.' }
    }
};

export const getUserInterests = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT interests FROM users WHERE user_id = $1;
            `,
            [user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error getting interests.' }
    }
};

export const getSearchTerms = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT search_terms FROM users WHERE user_id = $1;
            `,
            [user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error getting search terms.' }
    }
};

export const getJobTypes = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT job_types FROM users WHERE user_id = $1;
            `,
            [user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error getting search terms.' }
    }
};

export const updateUserInterests = async (user_id: string, interests: string[]) => {
    try {
        const result = await pool.query(
            `
            UPDATE users SET interests = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [interests, user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error updating interests.' }
    }
};

export const updateSearchTerms = async (user_id: string) => {

    const search_terms = await generateSearchTerms(user_id);
    console.log(search_terms)

    try {
        const result = await pool.query(
            `
            UPDATE users SET search_terms = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [search_terms, user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error updating interests.' }
    }
};

const generateSearchTerms = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT * FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        )
        const resumeText = result.rows[0].resume_text
        const interests = result.rows[0].interests
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
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
                ${interests}
                
                Extract and return ONLY a JSON array of 10 relevant search terms:
                The topics should be general, commonly used job title or role keywords, suitable for searching on college job boards like NUworks.
                Order them by priority.
                Make each search term general enough to return enough job results in a search.

                Example format: 
                [Software Engineer, Backend Engineer, Full Stack, Application Engineer, Platform Engineer, Data Engineer, DevOps, Cloud Engineer, Software Developer, Technical Engineer]
                
                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
                `
            }]
        })

        if (!message.content[0] || message.content[0].type !== 'text') {
            return { error: "Error with API." };
        }

        const search_terms = JSON.parse(message.content[0].text);
        return search_terms;

    } catch (error) {
        return { error: "Error extracting topics." }
    }
}

export const updateJobType = async (user_id: string, job_types: string[]) => {
    try {
        const result = await pool.query(
            `
            UPDATE users SET job_types = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [job_types, user_id]
        )

        if (result.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return result.rows[0];
    } catch (error) {
        return { error: 'Error updating job types.' }
    }
}

export const cacheShortResume = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT * FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        )
        const resumeText = result.rows[0].resume_text
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
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
        })

        if (!message.content[0] || message.content[0].type !== 'text') {
            return { error: "Error with API." };
        }

        const shortened_resume = JSON.parse(message.content[0].text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .replace(/`/g, "")
            .trim())

        const updated = await pool.query(
            `
            UPDATE resumes SET short_resume = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [shortened_resume, user_id]
        )

        if (updated.rows.length === 0) {
            return { error: 'User not found.' };
        }

        return updated.rows[0]

    } catch (error) {
        console.log(error)
        return { error: "Error caching shortened resume." }
    }
}