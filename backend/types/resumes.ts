import { type Request } from 'express';

export interface ResumeMetadataRequest extends Request<{ user_id: string }> {
  body: {
    file_name: string;
    file_type: string;
    file_size: number;
  };
}

export interface ResumeViewRequest extends Request {
  body: {
    key: string;
  };
}

export interface ResumeSaveRequest extends Request {
  body: {
    resume_id: string;
    key: string;
    user_id: string;
  };
}

export type PossibleInterestsRequest = Request<{ user_id: string }>;
export type LatestResumeRequest = Request<{ user_id: string }>;