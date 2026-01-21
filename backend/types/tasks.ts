import { type Request } from 'express';

export interface PostTaskRequest extends Request {
    body: {
        text: string
        description: string
    };
}

export interface PostInstructionsRequest extends Request {
    body: {
        employer_instructions: string
    };
}