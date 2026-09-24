import { type Request } from 'express';

export interface AddApplicationRequest extends Request {
  body: {
    job_id: string;
    status: string;
  };
}

export type UpdateApplicationStatusRequest = Request<
  { application_id: string },
  unknown,
  { status: string }
>;
