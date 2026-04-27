import { type Request } from 'express';

export type UUID = string;

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

export interface PutUserRequest extends Request {
  params: { user_id: UUID };
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

export type UserIdParams = { user_id: UUID };

export type UserIdRequest = Request<UserIdParams>;
export type UpdatePreferencesRequest = Request<UserIdParams, unknown, UpdatePreferencesBody>;
export type UpdateInterestsRequest = Request<UserIdParams, unknown, { interests: string[] }>;
export type UpdateJobTypesRequest = Request<UserIdParams, unknown, { job_types: string[] }>;
export type UpdateSearchTermsRequest = Request<UserIdParams>;
export type CacheShortResumeRequest = Request<UserIdParams>;
export type GetJobTypesRequest = Request<UserIdParams>;
export type GetSearchTermsRequest = Request<UserIdParams>;
export type GetUserInterestsRequest = Request<UserIdParams>;

export type PostUserResponse = PostUserObject | { error: string };