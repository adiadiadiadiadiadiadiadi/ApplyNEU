import { type Request } from 'express';

export interface AddApplicationRequest extends Request {
  params: {
    user_id: string;
  };
  body: {
    job_id: string;
    status: string;
  };
}

export type ApplicationStatsRequest = Request<{ user_id: string }>;
export type GetApplicationsRequest = Request<{ user_id: string }>;
export type UpdateApplicationStatusRequest = Request<
  { user_id: string; application_id: string },
  unknown,
  { status: string }
>;