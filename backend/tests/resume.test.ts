import request from 'supertest';
import { app } from '../app.ts';

jest.mock('../services/resume.service.ts', () => ({
  getUploadUrl: jest.fn(),
  completeResumeUpload: jest.fn(),
  getPossibleInterests: jest.fn(),
  getLatestResume: jest.fn(),
}));

jest.mock('../controller/middleware/requireUser.ts', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const USER_ID = 'test-user-id';

describe('POST /resumes/:user_id/upload-url', () => {
  it.todo('returns 200 with uploadUrl, key, and resumeId on valid input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('POST /resumes/save-resume', () => {
  it.todo('returns 200 and marks the resume as upload_complete');
  it.todo('returns 400 when resume_id, key, or user_id is missing');
  it.todo('returns 400 when resume_id + key + user_id do not match a pending record');
});

describe('GET /resumes/:user_id/possible-interests', () => {
  it.todo('returns 200 and list of possible interests');
  it.todo('returns 401 when user does not exist');
});

describe('GET /resumes/:user_id/latest', () => {
  it.todo('returns 200 and the latest resume record');
  it.todo('returns 404 when no resume exists for the user');
  it.todo('returns 401 when user does not exist');
});

export { USER_ID };
