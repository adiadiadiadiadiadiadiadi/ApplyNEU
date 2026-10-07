import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pdfParse from 'pdf-parse';
import { randomUUID } from 'crypto';
import { AppError } from '../../errors/AppError.ts';
import { pool } from '../../db/index.ts';
import type { ResumeSummary, PrimaryResumeUpdate, EnrichmentStatus } from '../../types/resumes.ts';

const MAX_ENRICHMENT_RETRIES = 3;

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    forcePathStyle: false,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

/**
 * Validates the file, generates a presigned S3 PUT URL, and kicks off an async resume save.
 * The save runs fire-and-forget so the client gets the URL without waiting for DB insertion.
 * @param user_id - ID of the uploading user
 * @param file_name - Original filename to store
 * @param file_type - MIME type; must be application/pdf
 * @param file_size - File size in bytes; must be ≤ 10 MB
 * @returns Presigned upload URL, S3 key, generated resumeId, and original filename
 */
export const getUploadUrl = async (user_id: string, file_name: string, file_type: string, file_size: number) => {
    const DESIRED_FILE_TYPE = 'application/pdf';
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    try {
        if (file_type !== DESIRED_FILE_TYPE || file_size > MAX_FILE_SIZE) {
            throw new AppError(400, 'Only PDFs under 10MB allowed.');
        }

        const uniqueId = randomUUID();
        const s3Key = `resumes/${uniqueId}.pdf`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: s3Key,
            ContentType: file_type,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        saveResume(uniqueId, s3Key, user_id, file_name, file_size);

        return {
            uploadUrl,
            key: s3Key,
            resumeId: uniqueId,
            originalFilename: file_name,
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to generate upload URL.');
    }
};

/**
 * Generates a short-lived presigned S3 GET URL for one of the caller's resumes.
 * The response headers are signed in so the PDF renders in a viewer rather than
 * downloading as the opaque uuid the S3 key uses.
 * @param resume_id - ID of the resume to view
 * @param user_id - Caller's authenticated user ID; must own the resume
 * @returns Presigned view URL, its expiry in seconds, and the original filename
 */
export const getViewUrl = async (resume_id: string, user_id: string) => {
    const EXPIRES_IN = 300;

    try {
        const owned = await pool.query(
            `SELECT key, file_name, upload_complete FROM resumes WHERE resume_id = $1 AND user_id::text = $2;`,
            [resume_id, user_id]
        );
        if (owned.rows.length === 0) throw new AppError(404, 'Resume not found.');

        const { key, file_name, upload_complete } = owned.rows[0];
        if (!upload_complete) throw new AppError(404, 'Resume not found.');
        if (!key) throw new AppError(404, 'Resume not found.');

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key,
            ResponseContentType: 'application/pdf',
            ResponseContentDisposition: `inline; filename="${file_name.replace(/[\\"]/g, '')}"`,
        });

        const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: EXPIRES_IN });

        return {
            viewUrl,
            expiresIn: EXPIRES_IN,
            fileName: file_name,
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to generate view URL.');
    }
};


/**
 * Collects an async byte stream into a single Buffer.
 * Returns an empty Buffer when stream is null (e.g. empty S3 object).
 */
const streamToBuffer = async (stream: AsyncIterable<Uint8Array> | null): Promise<Buffer> => {
    if (!stream) return Buffer.alloc(0);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/**
 * Downloads a PDF from S3 by key and extracts its plain text via pdf-parse.
 * Returns an empty string on any error so callers can proceed without text.
 * @param key - S3 object key of the PDF
 */
const extractTextFromPDF = async (key: string): Promise<string> => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key,
        });
        const response = await s3Client.send(command);
        const buffer = await streamToBuffer(response.Body as AsyncIterable<Uint8Array>);
        if (!buffer.length) return '';
        const parsed = await pdfParse(buffer);
        return parsed.text || '';
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return '';
    }
};

/**
 * Extracts text from the uploaded PDF and inserts the resume record into the DB.
 * Called fire-and-forget from getUploadUrl before the S3 upload completes,
 * so text may be empty; completeResumeUpload re-extracts after upload finishes.
 * @param resume_id - UUID for the new resume row
 * @param key - S3 object key
 * @param user_id - Owning user ID
 * @param file_name - Original filename
 * @param file_size_bytes - File size in bytes
 */
const saveResume = async (resume_id: string, key: string, user_id: string, file_name: string, file_size_bytes: number) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO resumes (resume_id, key, user_id, file_name, file_size_bytes, resume_text)
            VALUES ($1, $2, $3, $4, $5, '')
            RETURNING *;
            `,
            [resume_id, key, user_id, file_name, file_size_bytes]
        );
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to save resume.');
    }
};

/**
 * Marks a resume upload as complete, re-extracts text now that the file is fully in S3,
 * and makes it the user's primary resume. Its search terms are generated afterwards.
 * Requires the resume to exist, belong to the caller, and not already be marked complete,
 * preventing duplicate completions.
 * @param resume_id - ID of the resume to complete
 * @param key - S3 key used as an additional ownership check
 * @param user_id - Caller's authenticated user ID
 */
export const completeResumeUpload = async (resume_id: string, key: string, user_id: string) => {
    try {
        const existing = await pool.query(
            `SELECT * FROM resumes WHERE resume_id = $1 AND key = $2 AND user_id::text = $3 AND upload_complete = false`,
            [resume_id, key, user_id]
        );
        if (existing.rows.length === 0) throw new AppError(404, 'Resume not found or already completed.');

        const resume_text = await extractTextFromPDF(key);

        const result = await pool.query(
            `WITH completed AS (
                UPDATE resumes SET upload_complete = true, resume_text = $1, enrichment_status = 'pending'
                WHERE resume_id = $2
                RETURNING *
             ), claimed AS (
                UPDATE preferences p SET primary_resume_id = c.resume_id
                FROM completed c
                WHERE p.user_id = c.user_id
             )
             SELECT * FROM completed;`,
            [resume_text, resume_id]
        );

        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to complete resume upload.');
    }
};

/**
 * Saves the user's interest tags on their preferences. Interests only feed the scoring
 * prompt, so this neither re-enriches the resume nor moves the primary pointer.
 * @param resume_id - ID of a resume the caller owns
 * @param interests - Full replacement array of interest topic strings
 * @param user_id - Caller's authenticated user ID; must own the resume
 */
export const updateResumeInterests = async (resume_id: string, interests: string[], user_id: string) => {
    try {
        const owned = await pool.query(
            `SELECT resume_id FROM resumes WHERE resume_id = $1 AND user_id::text = $2;`,
            [resume_id, user_id]
        );
        if (owned.rows.length === 0) throw new AppError(404, 'Resume not found.');

        await pool.query(
            `UPDATE preferences SET interests = $1 WHERE user_id::text = $2`,
            [interests, user_id]
        );

        return { resume_id, interests };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error updating interests.');
    }
};

/**
 * Retrieves the search terms stored on a specific resume.
 * @param resume_id - ID of the resume
 * @param user_id - Caller's authenticated user ID; must own the resume
 */
export const getResumeSearchTerms = async (resume_id: string, user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT search_terms FROM resumes WHERE resume_id = $1 AND user_id::text = $2;`,
            [resume_id, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching search terms.');
    }
};

/**
 * Lists metadata (no full text) for every resume the user has uploaded, newest first.
 * @param user_id - ID of the user
 */
export const listResumes = async (user_id: string): Promise<ResumeSummary[]> => {
    try {
        const result = await pool.query(
            `
            SELECT r.resume_id, r.file_name, r.created_at, r.upload_complete,
                   (r.resume_id = p.primary_resume_id) IS TRUE AS is_primary,
                   r.enrichment_status,
                   ((r.enrichment_status = 'failed' OR (r.enrichment_status = 'none' AND r.upload_complete)) AND r.enrichment_retries < $2) AS can_retry
            FROM resumes r
            LEFT JOIN preferences p ON p.user_id = r.user_id
            WHERE r.user_id::text = $1
            ORDER BY r.created_at DESC;
            `,
            [user_id, MAX_ENRICHMENT_RETRIES]
        );
        return result.rows;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching resumes.');
    }
};

/**
 * Points the user's preferences at the given resume.
 *
 * Refuses a resume whose enrichment has not completed: without the search terms derived
 * from the user's interests an automation run has nothing to search on, so it would stall.
 *
 * The composite (resume_id, user_id) foreign key already refuses a resume the caller
 * does not own, but a constraint violation surfaces as a 500; the ownership read here
 * turns that into a 404 and leaves the constraint as the backstop against a resume
 * deleted between the two statements.
 * @param resume_id - ID of the resume to make primary
 * @param user_id - Caller's authenticated user ID; must own the resume
 */
export const setPrimaryResume = async (resume_id: string, user_id: string): Promise<PrimaryResumeUpdate> => {
    try {
        const owned = await pool.query(
            `SELECT upload_complete,
                    (enrichment_status = 'complete' AND cardinality(search_terms) > 0) AS enriched
             FROM resumes WHERE resume_id = $1 AND user_id::text = $2;`,
            [resume_id, user_id]
        );
        if (owned.rows.length === 0) throw new AppError(404, 'Resume not found.');
        if (!owned.rows[0].upload_complete) throw new AppError(400, 'Resume upload is not complete.');
        if (!owned.rows[0].enriched) throw new AppError(400, 'Resume has no search terms yet.');

        const result = await pool.query(
            `UPDATE preferences SET primary_resume_id = $1 WHERE user_id::text = $2 RETURNING primary_resume_id;`,
            [resume_id, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Preferences not found.');

        return { primary_resume_id: result.rows[0].primary_resume_id };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error setting primary resume.');
    }
};

/**
 * Deletes one of the caller's resumes. If it was the primary, the preferences foreign key
 * clears the pointer and getPrimaryResume falls back to the newest remaining resume.
 * 
 * @param resume_id - ID of the resume to delete
 * @param user_id - Caller's authenticated user ID; must own the resume
 * @returns The deleted resume's id
 */
export const deleteResume = async (resume_id: string, user_id: string) => {
    try {
        const result = await pool.query(
            `DELETE FROM resumes WHERE resume_id = $1 AND user_id::text = $2 RETURNING resume_id;`,
            [resume_id, user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0] as { resume_id: string };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error deleting resume.');
    }
};

/**
 * Records the outcome of an enrichment run. Only the server calls this: the worker when
 * a job exhausts its attempts, and the routes when the job cannot be enqueued.
 * @param resume_id - ID of the resume
 * @param status - New enrichment status
 */
export const setEnrichmentStatus = async (resume_id: string, status: EnrichmentStatus) => {
    await pool.query(
        `UPDATE resumes SET enrichment_status = $1 WHERE resume_id = $2;`,
        [status, resume_id]
    );
};

/**
 * Moves a failed enrichment back to pending so the caller can re-enqueue it, counting
 * the attempt against MAX_ENRICHMENT_RETRIES. A failure that keeps recurring is likely
 * deterministic, so past the cap each click would only be another paid AI call.
 * A finished upload still at 'none' is retryable too: those predate enrichment starting on
 * upload, when it waited on an interests step the user could skip.
 * The status check is part of the UPDATE so two concurrent retries cannot both claim it.
 * @param resume_id - ID of the resume to retry
 * @param user_id - Caller's authenticated user ID; must own the resume
 * @returns The resume id and its new status
 */
export const retryEnrichment = async (resume_id: string, user_id: string) => {
    try {
        const claimed = await pool.query(
            `UPDATE resumes SET enrichment_status = 'pending', enrichment_retries = enrichment_retries + 1
             WHERE resume_id = $1 AND user_id::text = $2
               AND (enrichment_status = 'failed' OR (enrichment_status = 'none' AND upload_complete))
               AND enrichment_retries < $3
             RETURNING resume_id, enrichment_status;`,
            [resume_id, user_id, MAX_ENRICHMENT_RETRIES]
        );
        if (claimed.rows.length > 0) return claimed.rows[0] as { resume_id: string; enrichment_status: EnrichmentStatus };

        const owned = await pool.query(
            `SELECT enrichment_status, enrichment_retries, upload_complete FROM resumes WHERE resume_id = $1 AND user_id::text = $2;`,
            [resume_id, user_id]
        );
        if (owned.rows.length === 0) throw new AppError(404, 'Resume not found.');
        const { enrichment_status, enrichment_retries, upload_complete } = owned.rows[0];
        const retryable = enrichment_status === 'failed' || (enrichment_status === 'none' && upload_complete);
        if (retryable && enrichment_retries >= MAX_ENRICHMENT_RETRIES) {
            throw new AppError(429, 'Enrichment retry limit reached.');
        }
        throw new AppError(409, 'Only a failed or never-started enrichment can be retried.');
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error retrying enrichment.');
    }
};

/**
 * Retrieves metadata (no full text) for the user's primary resume, falling back to their
 * newest when no primary is set, so a user whose primary was pruned still resolves to one.
 * @param user_id - ID of the user
 * @returns The resume, or null when the user has not uploaded one
 */
export const getPrimaryResume = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT resume_id, file_name, key, file_size_bytes, created_at
            FROM resumes
            WHERE user_id::text = $1
            ORDER BY (resume_id = (
                         SELECT primary_resume_id FROM preferences WHERE user_id::text = $1
                     )) DESC NULLS LAST,
                     created_at DESC
            LIMIT 1;
            `,
            [user_id]
        );
        return result.rows[0] ?? null;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching primary resume.');
    }
};
