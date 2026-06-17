import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';

const NON_REQUIRED_TASK_PATTERN =
    /\b(ad[\s-]?block(?:er)?|pop[\s-]?up(?: blocker)?|clear (?:your )?cache|cookies?|switch (?:to )?(?:another|different) browser|disable (?:browser )?extensions?|enable javascript|incognito|private mode|vpn|proxy|firewall|antivirus|troubleshoot|workaround|tip|optional|recommended|preference)\b/i;

/**
 * Inserts a single task for a user, optionally linked to a job application.
 * @param user_id - Owning user ID
 * @param text - Short action label (imperative form)
 * @param description - Detailed description or URL
 * @param application_id - Optional application to associate the task with
 */
export const addTask = async (user_id: string, text: string, description: string, application_id: string) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO tasks (user_id, text, description, application_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
            `,
            [user_id, text, description, application_id]
        );
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error creating task.');
    }
};

/**
 * Flips a task's completed state. When a task is marked complete, checks whether all
 * remaining tasks for the linked application are done; if so, auto-advances the
 * application status from 'external' to 'applied'. Status promotion errors are swallowed
 * to avoid breaking the toggle response.
 * @param task_id - UUID of the task to toggle
 */
export const toggleTask = async (task_id: string) => {
    try {
        const result = await pool.query(
            `
            UPDATE tasks SET completed = NOT completed WHERE task_id = $1
            RETURNING *;
            `,
            [task_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Task not found.');

        const updated = result.rows[0];

        if (updated.completed && updated.application_id && updated.user_id) {
            try {
                const remaining = await pool.query(
                    `
                    SELECT COUNT(*) AS count
                    FROM tasks
                    WHERE application_id = $1 AND user_id = $2 AND completed = false;
                    `,
                    [updated.application_id, updated.user_id]
                );
                if (Number(remaining.rows?.[0]?.count ?? 0) === 0) {
                    await pool.query(
                        `
                        UPDATE job_applications
                        SET status = 'applied'
                        WHERE application_id = $1 AND user_id = $2 AND status = 'external';
                        `,
                        [updated.application_id, updated.user_id]
                    );
                }
            } catch {
                // swallow to avoid breaking task toggle flow
            }
        }

        return updated;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error toggling task.');
    }
};

/**
 * Fetches all tasks for a user, ordered oldest-first.
 * @param user_id - Owning user ID
 * @param includeCompleted - When true, includes completed tasks; defaults to pending-only
 */
export const getTasks = async (user_id: string, includeCompleted = false) => {
    try {
        const result = await pool.query(
            `
            SELECT text, description, task_id, application_id, completed
            FROM tasks
            WHERE user_id = $1
            ${includeCompleted ? '' : 'AND completed = false'}
            ORDER BY created_at ASC;
            `,
            [user_id]
        );
        return result.rows;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching tasks.');
    }
};

/**
 * Fetches incomplete (pending) tasks for a user across all applications.
 * @param user_id - Owning user ID
 */
export const getCompletedTasksForApplication = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT text, description, task_id, application_id FROM tasks
            WHERE user_id = $1 AND completed = false
            ORDER BY created_at ASC;
            `,
            [user_id]
        );
        return result.rows;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching tasks.');
    }
};

/**
 * Deletes all tasks associated with a specific application for a user.
 * Typically called when an application is removed or reset.
 * @param user_id - Owning user ID (prevents cross-user deletion)
 * @param application_id - Application whose tasks should be deleted
 */
export const deleteTasksForApplication = async (user_id: string, application_id: string) => {
    try {
        await pool.query(
            `DELETE FROM tasks WHERE user_id = $1 AND application_id = $2;`,
            [user_id, application_id]
        );
        return { success: true };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error deleting tasks for application.');
    }
};
