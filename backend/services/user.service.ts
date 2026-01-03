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

    const search_terms = getSearchTerms(user_id);

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

export const getSearchTerms = async (user_id: string) => {
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
                
                Extract and return ONLY a JSON array of 60 relevant search terms:
                The topics should be general, commonly used job title or role keywords, suitable for searching on college job boards like NUworks.
                
                Example format: 
                [Software Engineer, Backend Engineer, Full Stack, Application Engineer, Platform Engineer, Data Engineer, DevOps, Cloud Engineer, Software Developer, Technical Engineer]
                
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