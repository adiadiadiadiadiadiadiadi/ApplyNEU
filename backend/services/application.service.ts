import { pool } from '../db/index.ts';
import { AppError } from '../errors/AppError.ts';

/**
 * Upserts a job application. On conflict (same job + user) updates applied_at.
 * @param user_id - Applying user
 * @param job_id - Target job
 * @param status - Initial application status string
 */
export const addJobApplication = async (user_id: string, job_id: string, status: string) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO job_applications (job_id, user_id, status)
        VALUES ($1, $2, $3::application_status)
        ON CONFLICT (job_id, user_id)
        DO UPDATE SET applied_at = NOW(),
        RETURNING *;
      `,
      [job_id, user_id, status]
    );
    if (!result.rows[0]) throw new AppError(409, 'Application already exists for this job/user.');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error creating job application.');
  }
};

/**
 * Returns aggregated application counts for a user broken down by time window and status.
 * All counts are cast to Number to avoid returning Postgres bigint strings to the client.
 * @param user_id - User whose stats to aggregate
 */
export const getUserApplicationStats = async (user_id: string) => {
  try {
    const result = await pool.query(
      `
        SELECT
          COUNT(*)                                                           AS total,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('day', NOW()))              AS today_count,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('week', NOW()))             AS week_count,
          COUNT(*) FILTER (WHERE applied_at >= date_trunc('year', NOW()))             AS year_count,
          COUNT(*) FILTER (WHERE status = 'applied')                                  AS applied_count,
          COUNT(*) FILTER (WHERE status = 'interview')                                AS interview_count,
          COUNT(*) FILTER (WHERE status = 'offer')                                    AS offer_count,
          COUNT(*) FILTER (WHERE status = 'rejected')                                 AS rejected_count,
          COUNT(*) FILTER (WHERE status IN ('pending', 'draft'))                      AS pending_count,
          COUNT(*) FILTER (WHERE status = 'external')                                 AS external_count
        FROM job_applications
        WHERE user_id = $1;
      `,
      [user_id]
    );
    const row = result.rows?.[0] ?? {};
    return {
      total:      Number(row.total          ?? 0),
      today:      Number(row.today_count    ?? 0),
      week:       Number(row.week_count     ?? 0),
      year:       Number(row.year_count     ?? 0),
      applied:    Number(row.applied_count  ?? 0),
      interviews: Number(row.interview_count ?? 0),
      offers:     Number(row.offer_count    ?? 0),
      rejected:   Number(row.rejected_count ?? 0),
      pending:    Number(row.pending_count  ?? 0),
      external:   Number(row.external_count ?? 0),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error fetching application stats.');
  }
};

/**
 * Fetches the 100 most recent applications for a user, joined with job metadata.
 * @param user_id - Owning user ID
 */
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
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error fetching applications.');
  }
};

/**
 * Updates an application's status after normalizing and validating the input value.
 * Throws 400 for unknown statuses before hitting the DB.
 * @param user_id - Must own the application (enforced in the WHERE clause)
 * @param application_id - Application to update
 * @param status - New status string
 */
export const updateApplicationStatus = async (user_id: string, application_id: string, status: string) => {
  try {
    const allowed = new Set([
      'pending', 'draft', 'applied', 'interview', 'offer',
      'rejected', 'external',
    ]);
    if (!allowed.has(status.toLowerCase())) {
      throw new AppError(400, 'Invalid status.');
    }

    const result = await pool.query(
      `
        UPDATE job_applications
        SET status = $3::application_status
        WHERE application_id = $2 AND user_id = $1
        RETURNING application_id, job_id, status, applied_at;
      `,
      [user_id, application_id, status.toLowerCase()]
    );
    if (!result.rowCount) throw new AppError(404, 'Application not found for user.');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error updating application status.');
  }
};
