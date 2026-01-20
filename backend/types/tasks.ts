import { type Request } from 'express';

export interface PostTaskRequest extends Request {
    body: {
        text: string
        description: string
    };
}