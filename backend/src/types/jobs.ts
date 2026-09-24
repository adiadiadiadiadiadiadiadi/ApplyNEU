import type { Request } from 'express';

export type SendJobDescriptionRequest = Request<
  Record<string, never>,
  unknown,
  {
    job_description: string;
    company: string;
    title: string;
  }
>;

export type AddJobRequest = Request<
  Record<string, never>,
  unknown,
  {
    company: string;
    title: string;
    description: string;
  }
>;
