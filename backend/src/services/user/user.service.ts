import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';

/**
 * Creates a user, their profile row, and a default preferences row atomically.
 * Uses a transaction with explicit ROLLBACK so all three inserts succeed or none do.
 * @param user_id - User's UUID
 * @param first_name - User's first name
 * @param last_name - User's last name
 * @param email - User's email address
 * @param grad_year - Expected graduation year
 */
export const addUser = async (user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO users (user_id, email) VALUES ($1, $2);`,
            [user_id, email]
        );
        await client.query(
            `INSERT INTO profile (user_id, first_name, last_name, grad_year) VALUES ($1, $2, $3, $4);`,
            [user_id, first_name, last_name, grad_year]
        );
        await client.query(
            `INSERT INTO preferences (user_id) VALUES ($1);`,
            [user_id]
        );
        await client.query('COMMIT');
        const result = await client.query(
            `
            SELECT u.user_id, p.first_name, p.last_name, u.email, p.grad_year
            FROM users u
            JOIN profile p ON p.user_id = u.user_id
            WHERE u.user_id = $1;
            `,
            [user_id]
        );
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error adding user.');
    } finally {
        client.release();
    }
};

/**
 * Fetches a user record joined with their profile row.
 * @param user_id - ID of the user to retrieve
 */
export const getUser = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT u.user_id, p.first_name, p.last_name, u.email, p.grad_year
            FROM users u JOIN profile p ON p.user_id = u.user_id
            WHERE u.user_id = $1;
            `,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting user.');
    }
};

/**
 * Updates a user's email and profile fields atomically.
 * Uses a transaction so that a profile update failure rolls back the email change too.
 * @param user_id - ID of the user to update
 * @param first_name - Updated first name
 * @param last_name - Updated last name
 * @param email - Updated email address
 * @param grad_year - Updated graduation year
 */
export const updateUser = async (user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE users SET email = $1 WHERE user_id = $2;`,
            [email, user_id]
        );
        const result = await client.query(
            `
            UPDATE profile SET first_name = $1, last_name = $2, grad_year = $3
            WHERE user_id = $4
            RETURNING user_id, first_name, last_name, grad_year;
            `,
            [first_name, last_name, grad_year, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        await client.query('COMMIT');
        return { ...result.rows[0], email };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating user.');
    } finally {
        client.release();
    }
};

