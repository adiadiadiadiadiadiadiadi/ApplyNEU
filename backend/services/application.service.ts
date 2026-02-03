import { pool } from '../db/index.ts';

export const addJobApplication = async (user_id: string, company: string, title: string, description: string) => {
    try {
        const job = await pool.query(
            `
            SELECT * FROM jobs WHERE title = $1 AND company = $2 AND description = $3
            VALUES ($1, $2, $3);
            `,
            [title, company, description]
        );

        console.log(job)

        // const result = await pool.query(
        //     `
        //     INSERT INTO job_applications (job_id, user_id)
        //     VALUES ($1, $2)
        //     RETURNING *;
        //     `,
        //     [job_id, user_id]
        // );
        // return result.rows[0];
    } catch (error) {
        return { error: "Error occured while inserting into job applications. "}
    }
}

