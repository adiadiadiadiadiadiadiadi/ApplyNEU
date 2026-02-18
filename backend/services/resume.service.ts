import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pdfParse from 'pdf-parse';
import { randomBytes } from 'crypto';
import { pool } from '../db/index.ts';
import Anthropic from '@anthropic-ai/sdk';

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
        return { error: 'Failed to save resume.' };
    }
};

export const getPossibleInterests = async (user_id: string) => {
    try {
        const result = await pool.query(
            `SELECT resume_text FROM resumes WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 1;`,
            [user_id]
        )
        const resumeText = result.rows[0].resume_text
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: 
                `
                You are analyzing a resume to extract job-related topics the person might be interested in.

                Resume text:
                ${resumeText}
                
                Extract and return ONLY a JSON array of 60 relevant topics including:
                - ~40: Technical skills (e.g., "Python", "React", "AWS")
                - ~6: Industries (e.g., "FinTech", "Healthcare", "E-commerce")
                - ~6: Job types (e.g., "Software Engineering", "Data Science", "Product Management")
                - ~8: Domains (e.g., "Machine Learning", "Cloud Infrastructure", "Mobile Development")
                
                Return about 60 topics. Be specific but not overly granular.
                About 15 topics should not be on the user's resume, but be related.
                
                Example format: ["Python", "Machine Learning", "FinTech", "Backend Development", "AWS"]
                
                Return ONLY the JSON array, nothing else. There should be no extra whitespace or punctuation.
                `
            }]
        })

        if (!message.content[0] || message.content[0].type !== 'text') {
            return { error: "Error with API." };
        }

        const topics = JSON.parse(message.content[0].text);
        return topics;

    } catch (error) {
        return { error: "Error extracting topics." }
    }
}

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
        )

        if (result.rows.length === 0) {
            return { error: 'Resume not found.' }
        }

        return result.rows[0]
    } catch (error) {
        return { error: 'Error fetching latest resume.' }
    }
}