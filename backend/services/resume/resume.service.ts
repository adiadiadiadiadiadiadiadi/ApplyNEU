import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pdfParse from 'pdf-parse';
import { randomBytes } from 'crypto';
import { AppError } from '../../errors/AppError.ts';
import { pool } from '../../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';
import { withRetry } from '../../utils/retry.ts';
import { cacheShortResume } from './ai.resume.service.ts';

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

        const uniqueId = randomBytes(16).toString('hex');
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
        const resume_text = await extractTextFromPDF(key);
        const result = await pool.query(
            `
            INSERT INTO resumes (resume_id, key, user_id, file_name, file_size_bytes, resume_text)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
            `,
            [resume_id, key, user_id, file_name, file_size_bytes, resume_text]
        );
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to save resume.');
    }
};

/**
 * Marks a resume upload as complete and re-extracts text now that the file is fully in S3.
 * Requires the resume to exist and not already be marked complete, preventing duplicate completions.
 * @param resume_id - ID of the resume to complete
 * @param key - S3 key used as an additional ownership check
 * @param user_id - Owning user ID
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
            `UPDATE resumes SET upload_complete = true, resume_text = $1 WHERE resume_id = $2 RETURNING *`,
            [resume_text, resume_id]
        );
        cacheShortResume(resume_id);
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Failed to complete resume upload.');
    }
};

/**
 * Uses Claude Haiku to derive 50 job-related interest topics from the user's latest resume.
 * 15 of the topics are intentionally outside the resume to surface adjacent interests.
 * @param user_id - ID of the user whose resume is analyzed
 * @returns Array of 50 topic strings
 */
export const getPossibleInterests = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT resume_text FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        );
        if (!result.rows.length) throw new AppError(404, 'Resume not found.');
        const resumeText = result.rows[0].resume_text;

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await withRetry(() => anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content:
                `
                You are analyzing a resume to extract job-related topics the person might be interested in.

                Resume text:
                ${resumeText}

                Extract and return ONLY a JSON array of 50 relevant topics including:
                - 5: Technical skills (e.g., "Python", "React", "AWS")
                - 15: Industries (e.g., "FinTech", "Healthcare", "E-commerce")
                - 15: Job types (e.g., "Software Engineering", "Data Science", "Product Management")
                - 15: Domains (e.g., "Machine Learning", "Cloud Infrastructure", "Mobile Development")

                Return 50 topics. Be specific but not overly granular.
                Exactly 15 topics should not be on the user's resume, but be related.

                Output format:
                ["Topic1","Topic2",...,"Topic50"]

                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
                `
            }]
        }));

        if (!message.content[0] || message.content[0].type !== 'text') {
            throw new AppError(502, 'Error with API.');
        }

        return JSON.parse(message.content[0].text);
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error extracting interests from resume.');
    }
};

/**
 * Retrieves metadata (no full text) for the user's most recently uploaded resume.
 * @param user_id - ID of the user
 */
export const getLatestResume = async (user_id: string) => {
    try {
        const result = await pool.query(
            `
            SELECT resume_id, file_name, key, file_size_bytes, created_at
            FROM resumes
            WHERE user_id::text = $1
            ORDER BY created_at DESC
            LIMIT 1;
            `,
            [user_id]
        );
        if (result.rows.length === 0) throw new AppError(404, 'Resume not found.');
        return result.rows[0];
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'Error fetching latest resume.');
    }
};
