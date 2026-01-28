import { pool } from '../db/index.ts';

export const addJobApplication = async (job_id: string, user_id: string) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO job_applications (job_id, user_id)
            VALUES ($1, $2)
            RETURNING *;
            `,
            [job_id, user_id]
        );
        return result.rows[0];
    } catch (error) {
        return { error: "Error occured while inserting into job applications. "}
    }
}

