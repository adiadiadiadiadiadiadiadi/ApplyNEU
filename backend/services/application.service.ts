import { pool } from '../db/index.ts';

export const addJobApplication = async (
  user_id: string, company: string, title: string, description: string, status: string
  ) => {
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
        DO UPDATE SET applied_at = NOW(), status = $3
        RETURNING *;
      `,
      [job_id, user_id, status]
    );

    return result.rows[0] ?? { error: 'Application already exists for this job/user.' };
  } catch (error) {
    return { error: 'Error occurred while inserting into job applications.' };
  }
}

export const getUserApplicationStats = async (user_id: string) => {
  try {
    const result = await pool.query(
      `
        SELECT
          COUNT(*)                                                           AS total,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('day', NOW()))    AS today_count,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('week', NOW()))   AS week_count,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('year', NOW()))   AS year_count,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('applied', 'submitted'))         AS applied_count,
          COUNT(*) FILTER (WHERE LOWER(status) = 'interview')                      AS interview_count,
          COUNT(*) FILTER (WHERE LOWER(status) = 'offer')                          AS offer_count,
          COUNT(*) FILTER (WHERE LOWER(status) = 'rejected')                       AS rejected_count,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('pending', 'draft'))            AS pending_count,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('external', 'external action needed')) AS external_count
        FROM job_applications
        WHERE user_id = $1;
      `,
      [user_id]
    );

    const row = result.rows?.[0] ?? {};
    return {
      total:      Number(row.total         ?? 0),
      today:      Number(row.today_count   ?? 0),
      week:       Number(row.week_count    ?? 0),
      year:       Number(row.year_count    ?? 0),
      applied:    Number(row.applied_count   ?? 0),
      interviews: Number(row.interview_count ?? 0),
      offers:     Number(row.offer_count     ?? 0),
      rejected:   Number(row.rejected_count  ?? 0),
      pending:    Number(row.pending_count   ?? 0),
      external:   Number(row.external_count  ?? 0),
    };
  } catch (error) {
    return { error: 'Error fetching application stats.' };
  }
}

export const getUserApplications = async (user_id: string) => {
  try {
    const result = await pool.query(
      `
        SELECT
          ja.application_id,
          ja.job_id,
          ja.status,
          ja.applied_at,
          j.company,
          j.title,
          j.description
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.job_id
        WHERE ja.user_id = $1
        ORDER BY ja.applied_at DESC
        LIMIT 100;
      `,
      [user_id]
    );
    return result.rows;
  } catch (error) {
    return { error: 'Error fetching applications.' };
  }
}