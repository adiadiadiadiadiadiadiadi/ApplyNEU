import { pool } from '../db/index.ts';

export const addJobApplication = async (user_id: string, company: string, title: string, description: string) => {
  try {
    // Find an existing job for this title/company, prefer most recent.
    // const job = await pool.query(
    //   `SELECT * FROM jobs WHERE title = $1 AND company = $2 ORDER BY created_at DESC NULLS LAST LIMIT 1;`,
    //   [title, company]
    // );

    // let job_id: string | undefined = job.rows[0]?.job_id;

    // if (!job_id) {
    //   // Upsert the job so the application can be recorded.
    //   const inserted = await pool.query(
    //     `
    //       INSERT INTO jobs (company, title, description)
    //       VALUES ($1, $2, $3)
    //       ON CONFLICT (company, title)
    //       DO UPDATE SET description = EXCLUDED.description
    //       RETURNING *;
    //     `,
    //     [company, title, description]
    //   );
    //   job_id = inserted.rows[0]?.job_id;
    // }

    // if (!job_id) {
    //   return { error: 'Job not found or could not be created.' };
    // }

    const result = await pool.query(
      `
        INSERT INTO job_applications (job_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (job_id, user_id) DO NOTHING
        RETURNING *;
      `,
      ['cb06ccc4-8ac6-4876-b166-4670f7d318ae', user_id]
    );

    if (!result.rows.length) {
      return { error: 'Application already exists for this job/user.' };
    }

    return result.rows[0];
  } catch (error) {
    console.error('addJobApplication error', error);
    return { error: 'Error occurred while inserting into job applications.' };
  }
}