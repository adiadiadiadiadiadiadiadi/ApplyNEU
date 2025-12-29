import { type Request } from 'express';

export interface ResumeMetadataRequest extends Request {
    body: {
        file_name: string,
        file_type: string,
        file_size: number
    };
}