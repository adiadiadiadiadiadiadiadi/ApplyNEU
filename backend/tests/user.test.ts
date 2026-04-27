import request from 'supertest';
import { app } from '../app.ts';

jest.mock('../services/user.service.ts', () => ({
  addUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  getUserPreferences: jest.fn(),
  updateUserPreferences: jest.fn(),
  getUserInterests: jest.fn(),
  updateUserInterests: jest.fn(),
  updateJobType: jest.fn(),
  getJobTypes: jest.fn(),
  updateSearchTerms: jest.fn(),
  getSearchTerms: jest.fn(),
  cacheShortResume: jest.fn(),
}));

jest.mock('../controller/middleware/requireUser.ts', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const USER_ID = 'test-user-id';

describe('POST /users/new', () => {
  it.todo('returns 200 and the created user on valid input');
  it.todo('returns 400 when required body fields are missing');
});

describe('GET /users/:user_id', () => {
  it.todo('returns 200 and the user record when found');
  it.todo('returns 404 when user does not exist');
});

describe('PUT /users/:user_id', () => {
  it.todo('returns 200 and updated user on valid input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('GET /users/:user_id/preferences', () => {
  it.todo('returns 200 and preference flags');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /users/:user_id/preferences', () => {
  it.todo('returns 200 and updated preferences');
  it.todo('returns 401 when user does not exist');
});

describe('GET /users/:user_id/interests', () => {
  it.todo('returns 200 and list of interests');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /users/:user_id/interests', () => {
  it.todo('returns 200 and updated interests');
  it.todo('returns 400 when interests field is missing');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /users/:user_id/job-types', () => {
  it.todo('returns 200 and updated job types');
  it.todo('returns 400 when job_types field is missing');
  it.todo('returns 401 when user does not exist');
});

describe('GET /users/:user_id/job-types', () => {
  it.todo('returns 200 and list of job types');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /users/:user_id/search-terms', () => {
  it.todo('returns 200 after regenerating search terms');
  it.todo('returns 401 when user does not exist');
});

describe('GET /users/:user_id/search-terms', () => {
  it.todo('returns 200 and list of search terms');
  it.todo('returns 401 when user does not exist');
});

describe('POST /users/:user_id/cache-short-resume', () => {
  it.todo('returns 200 after caching the short resume');
  it.todo('returns 401 when user does not exist');
});

export { USER_ID };
