import { pool } from '../db/index.ts';
import { AppError } from '../errors/AppError.ts';

export const getUserPreferences = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT job_types, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications
             FROM preferences WHERE user_id = $1;`,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error getting preferences.');
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

export const updateJobType = async (user_id: string, job_types: string[]) => {
    try {
        const result = await pool.query(
            `UPDATE preferences SET job_types = $1 WHERE user_id = $2 RETURNING *;`,
            [job_types, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating job types.');
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
            `UPDATE preferences
             SET
                 wait_for_approval   = COALESCE($1, wait_for_approval),
                 recent_jobs         = COALESCE($2, recent_jobs),
                 job_match           = COALESCE($3, job_match),
                 unpaid_roles        = COALESCE($4, unpaid_roles),
                 email_notifications = COALESCE($5, email_notifications)
             WHERE user_id = $6
             RETURNING job_types, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications;`,
            [wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'User not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating preferences.');
    }
};



