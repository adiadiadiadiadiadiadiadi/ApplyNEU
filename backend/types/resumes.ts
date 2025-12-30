import { type Request } from 'express';

export interface ResumeMetadataRequest extends Request {
    body: {
        file_name: string,
        file_type: string,
        file_size: number
    };
}

export interface ResumeViewRequest extends Request {
    body: {
        key: string
    };
}

export interface ResumeSaveRequest extends Request {
    body: {
        resume_id: string,
        key: string,
        user_id: string,
        file_name: string,
        file_size_bytes: number
    };
}