import { type Request } from 'express';

export type UUID = string;

export interface PostUserObject {
  user_id: UUID;
  first_name: string;
  last_name: string;
  grad_year: number;
}

export interface PostUserRequest extends Request {
  body: PostUserObject;
}

export interface PutUserRequest extends Request {
  body: PostUserObject;
}

export interface UpdatePreferencesBody {
  job_types: string[];
  wait_for_approval: boolean;
  recent_jobs: boolean;
  job_match: string;
  unpaid_roles: boolean;
  email_notifications: boolean;
}

export type UpdatePreferencesRequest = Request<Record<string, never>, unknown, UpdatePreferencesBody>;
export type UpdateJobTypesRequest = Request<Record<string, never>, unknown, { job_types: string[] }>;

export type PostUserResponse = PostUserObject | { error: string };