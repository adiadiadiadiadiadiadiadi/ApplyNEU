import { type Request } from 'express';

export interface PostTaskRequest extends Request {
  params: { user_id: string };
  body: {
    text: string;
    description: string;
    application_id?: string;
  };
}

export interface PostInstructionsRequest extends Request {
  params: { user_id: string };
  body: {
    employer_instructions: string;
    application_id?: string;
    company?: string;
    title?: string;
  };
}

export type ToggleTaskRequest = Request<{ task_id: string }>;
export type GetTasksRequest = Request<
  { user_id: string },
  unknown,
  unknown,
  { includeCompleted?: string }
>;
export type ClearTasksRequest = Request<{ user_id: string; application_id: string }>;