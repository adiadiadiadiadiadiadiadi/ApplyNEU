import { pool } from '../db/index.ts';

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
