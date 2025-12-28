import { pool } from '../db/index.ts';

export const addUser = async (user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => {
    const result = await pool.query(
        `
        INSERT INTO users (user_id, first_name, last_name, email, grad_year)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [user_id, first_name, last_name, email, grad_year]
    )
    return result.rows[0]
};
