import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { pool } from '../db/index.ts';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    forcePathStyle: false,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export const getUploadUrl = async (file_name: string, file_type: string, file_size: number) => {
    const DESIRED_FILE_TYPE = 'application/pdf'
    const MAX_FILE_SIZE = 10 * 1024 * 1024

    try {
        if (file_type !== DESIRED_FILE_TYPE || file_size > MAX_FILE_SIZE) {
            return { error: 'Only PDFs under 10MB allowed.' };
        }

        const uniqueId = randomBytes(16).toString('hex');
        const s3Key = `resumes/${uniqueId}.pdf`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: s3Key,
            ContentType: file_type,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 300,
        });

        return {
            uploadUrl,
            key: s3Key,
            resumeId: uniqueId,
            originalFilename: file_name,
        };
    } catch (error) {
        return { error: 'Failed to generate upload URL.' };
    }
};

export const saveResumeDate = async (resume_id: string, key: string, user_id: string, file_name: string, file_size_bytes: number) => {
    const result = await pool.query(
        `
        INSERT INTO resumes (resume_id, key, user_id, file_name, file_size_bytes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [resume_id, key, user_id, file_name, file_size_bytes]
    )
    return result.rows[0]
}