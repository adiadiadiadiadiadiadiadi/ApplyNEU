import { type Request } from 'express';

export interface PostTaskRequest extends Request {
  body: {
    text: string;
    description: string;
    application_id: string;
  };
}

export interface PostInstructionsRequest extends Request {
  body: {
    employer_instructions: string;
    application_id: string;
    company?: string;
    title?: string;
  };
}

export type ToggleTaskRequest = Request<{ task_id: string }>;
export type GetTasksRequest = Request<
  Record<string, never>,
  unknown,
  unknown,
  { includeCompleted?: string }
>;
export type ClearTasksRequest = Request<{ application_id: string }>;
