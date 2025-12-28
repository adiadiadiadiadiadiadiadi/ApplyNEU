import { type Request } from 'express';

type UUID = string;

export interface PostUserObject {
    user_id: UUID;
    first_name: string;
    last_name: string;
    email: string;
    grad_year: number;
}

export interface PostUserRequest extends Request {
    body: PostUserObject;
}

export type PostUserResponse = PostUserObject | { error: string }