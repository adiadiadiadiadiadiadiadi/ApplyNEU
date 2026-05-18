import request from 'supertest';
import { app } from '../app.ts';

jest.mock('../services/job.service.ts', () => ({
  sendJobDescription: jest.fn(),
  addJob: jest.fn(),
}));

jest.mock('../controller/middleware/requireUser.ts', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const USER_ID = 'test-user-id';

describe('POST /jobs/:user_id/send-job', () => {
  it.todo('returns 200 on valid job description input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('POST /jobs/add-job', () => {
  it.todo('returns 200 and the created job on valid input');
  it.todo('returns 400 when required body fields are missing');
});

export { USER_ID };
