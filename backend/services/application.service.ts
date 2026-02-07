import { pool } from '../db/index.ts';

// Inserts or updates a job application for a user/job.
// - Finds (or creates) the job by company + title (updates description on conflict)
// - Inserts into job_applications; on conflict, only applied_at is updated
// Returns the inserted/updated application row or an { error } object.
export const addJobApplication = async (user_id: string, company: string, title: string, description: string) => {
  try {
    console.log('[addJobApplication] start', { user_id, company, title });

    // Find an existing job for this title/company, prefer most recent.
    const job = await pool.query(
      `SELECT * FROM jobs WHERE title = $1 AND company = $2 LIMIT 1;`,
      [title, company]
    );

    let job_id: string | undefined = job.rows[0]?.job_id;

    // If missing, upsert the job so the application can be recorded.
    if (!job_id) {
      console.log('[addJobApplication] job not found, inserting', { company, title });
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
      console.log('[addJobApplication] job insert/upsert result', { rowCount: inserted.rowCount, job_id });
    } else {
      console.log('[addJobApplication] found existing job', { job_id });
    }

    if (!job_id) {
      console.error('[addJobApplication] missing job_id after upsert');
      return { error: 'Job not found or could not be created.' };
    }

    // Insert application; if it already exists for this job/user, only update applied_at.
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

    console.log('[addJobApplication] insert/update application result', { rowCount: result.rowCount, rows: result.rows });

    return result.rows[0] ?? { error: 'Application already exists for this job/user.' };
  } catch (error) {
    console.error('addJobApplication error', error);
    return { error: 'Error occurred while inserting into job applications.' };
  }
}