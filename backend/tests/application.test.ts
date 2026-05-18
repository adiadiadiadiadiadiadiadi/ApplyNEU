import request from 'supertest';
import { app } from '../app.ts';

jest.mock('../services/application.service.ts', () => ({
  addJobApplication: jest.fn(),
  getUserApplicationStats: jest.fn(),
  getUserApplications: jest.fn(),
  updateApplicationStatus: jest.fn(),
}));

jest.mock('../controller/middleware/requireUser.ts', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const USER_ID = 'test-user-id';
const APP_ID = 'test-app-id';

describe('POST /applications/:user_id/new', () => {
  it.todo('returns 200 and the created application on valid input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('GET /applications/:user_id/stats', () => {
  it.todo('returns 200 and stats for the user');
  it.todo('returns 401 when user does not exist');
});

describe('GET /applications/:user_id', () => {
  it.todo('returns 200 and list of applications for the user');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /applications/:user_id/:application_id/status', () => {
  it.todo('returns 200 and updated application on valid input');
  it.todo('returns 400 when status field is missing');
  it.todo('returns 401 when user does not exist');
});

export { USER_ID, APP_ID };
