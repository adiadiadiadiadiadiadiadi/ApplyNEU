import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';

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

export const getUserPreferences = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT job_types, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications
            FROM preferences
            WHERE user_id = $1;
            `,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting preferences.');
    }
};

export const getUserInterests = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT interests FROM profile WHERE user_id = $1;`,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting interests.');
    }
};

export const getSearchTerms = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT search_terms FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting search terms.');
    }
};

export const getJobTypes = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT job_types FROM preferences WHERE user_id = $1;`,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting job types.');
    }
};

export const updateUserInterests = async (user_id: string, interests: string[]) => {
    try {
        const result = await pool.query(
            `
            UPDATE profile SET interests = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [interests, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating interests.');
    }
};

export const updateJobType = async (user_id: string, job_types: string[]) => {
    try {
        const result = await pool.query(
            `
            UPDATE preferences SET job_types = $1 WHERE user_id = $2
            RETURNING *;
            `,
            [job_types, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating job types.');
    }
};

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

export const updateUserPreferences = async (
    user_id: string,
    wait_for_approval?: boolean,
    recent_jobs?: number | boolean,
    job_match?: string,
    unpaid_roles?: boolean,
    email_notifications?: boolean
) => {
    try {
        const result = await pool.query(
            `
            UPDATE preferences
            SET
                wait_for_approval   = COALESCE($1, wait_for_approval),
                recent_jobs         = COALESCE($2, recent_jobs),
                job_match           = COALESCE($3, job_match),
                unpaid_roles        = COALESCE($4, unpaid_roles),
                email_notifications = COALESCE($5, email_notifications)
            WHERE user_id = $6
            RETURNING job_types, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications;
            `,
            [wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating preferences.');
    }
};
