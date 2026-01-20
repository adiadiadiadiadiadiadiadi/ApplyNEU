import { pool } from '../db/index.ts';

export const addTask = async (user_id: string, text: string) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO tasks (user_id, text)
            VALUES ($1, $2)
            RETURNING *;
            `,
            [user_id, text]
        );
        return result.rows[0];

    } catch (error) {
        return { error: "Error creating task." }
    }
}

export const toggleTask = async (task_id: string) => {
    const result = await pool.query(
        `
        UPDATE tasks SET status = NOT status WHERE task_id = $1
        RETURNING *;
        `,
        [task_id]
    )

    if (result.rows.length === 0) {
        return { error: 'Task not found.' };
    }

    return result.rows[0];
}