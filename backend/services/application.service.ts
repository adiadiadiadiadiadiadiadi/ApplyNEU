import { pool } from '../db/index.ts';

export const addJobApplication = async (user_id: string, company: string, title: string, description: string) => {
  try {

    const job = await pool.query(
      `SELECT * FROM jobs WHERE title = $1 AND company = $2 LIMIT 1;`,
      [title, company]
    );

    let job_id: string | undefined = job.rows[0]?.job_id;

    if (!job_id) {
      const inserted = await pool.query(
        `
          INSERT INTO jobs (company, title, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (company, title)
          DO UPDATE SET description = EXCLUDED.description
          RETURNING *;
        `,
        [company, title, description]
      );
      job_id = inserted.rows[0]?.job_id;
    }

    if (!job_id) {
      return { error: 'Job not found or could not be created.' };
    }

    const result = await pool.query(
      `
        INSERT INTO job_applications (job_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (job_id, user_id)
        DO UPDATE SET applied_at = NOW()
        RETURNING *;
      `,
      [job_id, user_id]
    );

    return result.rows[0] ?? { error: 'Application already exists for this job/user.' };
  } catch (error) {
    return { error: 'Error occurred while inserting into job applications.' };
  }
}