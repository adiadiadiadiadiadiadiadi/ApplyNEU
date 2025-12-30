import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pdfParse from 'pdf-parse';
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

export const getViewUrl = async (key: string) => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: key,
        })

        const viewUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
        });

        return {
            viewUrl,
            expiresIn: 3600,
        };
    } catch (error) {
        return { error: 'Failed to generate view URL.' };
    }
}

const streamToBuffer = async (stream: AsyncIterable<Uint8Array> | null): Promise<Buffer> => {
    if (!stream) return Buffer.alloc(0);

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

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

export const saveResume = async (resume_id: string, key: string, user_id: string, file_name: string, file_size_bytes: number) => {
    try {
        const resume_text = await extractTextFromPDF(key);
        console.log(resume_text)
    
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
        return { error: 'Failed to save.' };
    }
};