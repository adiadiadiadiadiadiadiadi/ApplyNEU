import { pool } from '../db/index.ts';
import { AppError } from '../errors/AppError.ts';
import { normalizeAndHash } from '../utils/hash.ts';

/**
 * Inserts a job, deduplicating on (company, title, description_hash) so that a repost
 * with a changed description becomes a new job_id rather than mutating the existing row.
 * A conflict therefore means the description is byte-identical after normalization, which
 * makes the DO UPDATE a no-op kept only so RETURNING yields the existing row.
 * @param company - Company name
 * @param title - Job title
 * @param description - Full job description text
 */
export const addJob = async (company: string, title: string, description: string) => {
  try {
    const result = await pool.query(
      `
        INSERT INTO jobs (company, title, description, description_hash)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company, title, description_hash)
        DO UPDATE SET description = EXCLUDED.description
        RETURNING *;
      `,
      [company, title, description, normalizeAndHash(description)]
    );
    if (!result.rows[0]) throw new AppError(500, 'Error creating job.');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error creating job.');
  }
};