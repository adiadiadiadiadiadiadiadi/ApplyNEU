import { jest } from '@jest/globals';
import request from 'supertest';

// Native ESM: mocks must be registered with unstable_mockModule and the modules
// under test pulled in via dynamic import() afterwards so the mocks take effect.
jest.unstable_mockModule('../../src/services/preference.service.ts', () => ({
  getUserPreferences: jest.fn(),
  updateUserPreferences: jest.fn(),
  getJobTypes: jest.fn(),
  updateJobType: jest.fn(),
}));

jest.unstable_mockModule('../../src/controller/middleware/authenticate.ts', () => ({
  // Default passthrough authenticating as USER_ID; tests override it to simulate a rejected token.
  authenticate: jest.fn((req: { auth?: { userId: string } }, _res: unknown, next: () => void) => {
    req.auth = { userId: USER_ID };
    next();
  }),
}));

const { getUserPreferences, updateUserPreferences, getJobTypes, updateJobType } = await import(
  '../../src/services/preference.service.ts'
);
const { authenticate } = await import('../../src/controller/middleware/authenticate.ts');
const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';

type ServiceMock = jest.Mock<(...args: any[]) => Promise<any>>;
type MiddlewareMock = jest.Mock<(...args: any[]) => any>;

const mockGetUserPreferences = getUserPreferences as ServiceMock;
const mockUpdateUserPreferences = updateUserPreferences as ServiceMock;
const mockGetJobTypes = getJobTypes as ServiceMock;
const mockUpdateJobType = updateJobType as ServiceMock;
const mockAuthenticate = authenticate as MiddlewareMock;

const rejectToken = () =>
  mockAuthenticate.mockImplementationOnce(
    (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) =>
      res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  jest.resetAllMocks();
  mockAuthenticate.mockImplementation((req: { auth?: { userId: string } }, _res: unknown, next: () => void) => {
    req.auth = { userId: USER_ID };
    next();
  });
});

describe('GET /me/preferences', () => {
  it('returns 200 and the preference flags', async () => {
    const prefs = {
      wait_for_approval: true,
      recent_jobs: false,
      job_match: true,
      unpaid_roles: false,
      email_notifications: true,
    };
    mockGetUserPreferences.mockResolvedValue(prefs);

    const res = await request(app).get('/me/preferences');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(prefs);
    expect(mockGetUserPreferences).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 401 when the token is rejected', async () => {
    rejectToken();

    const res = await request(app).get('/me/preferences');

    expect(res.status).toBe(401);
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockGetUserPreferences.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/me/preferences');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error.' });
  });
});

describe('PUT /me/preferences', () => {
  it('returns 200 and the updated preferences', async () => {
    const body = {
      wait_for_approval: false,
      recent_jobs: true,
      job_match: true,
      unpaid_roles: false,
      email_notifications: false,
    };
    mockUpdateUserPreferences.mockResolvedValue(body);

    const res = await request(app).put('/me/preferences').send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
      USER_ID,
      false,
      true,
      true,
      false,
      false
    );
  });

  it('returns 401 when the token is rejected', async () => {
    rejectToken();

    const res = await request(app).put('/me/preferences').send({});

    expect(res.status).toBe(401);
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockUpdateUserPreferences.mockRejectedValue(new Error('db down'));

    const res = await request(app).put('/me/preferences').send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error.' });
  });
});

describe('GET /me/preferences/job-types', () => {
  it('returns 200 and the list of job types', async () => {
    const jobTypes = ['full-time', 'internship'];
    mockGetJobTypes.mockResolvedValue(jobTypes);

    const res = await request(app).get('/me/preferences/job-types');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(jobTypes);
    expect(mockGetJobTypes).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 401 when the token is rejected', async () => {
    rejectToken();

    const res = await request(app).get('/me/preferences/job-types');

    expect(res.status).toBe(401);
    expect(mockGetJobTypes).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockGetJobTypes.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/me/preferences/job-types');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error.' });
  });
});

describe('PUT /me/preferences/job-types', () => {
  it('returns 200 and the updated job types on valid input', async () => {
    const jobTypes = ['full-time'];
    mockUpdateJobType.mockResolvedValue(jobTypes);

    const res = await request(app)
      .put('/me/preferences/job-types')
      .send({ job_types: jobTypes });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(jobTypes);
    expect(mockUpdateJobType).toHaveBeenCalledWith(USER_ID, jobTypes);
  });

  it('returns 400 when the job_types field is missing', async () => {
    const res = await request(app).put('/me/preferences/job-types').send({});

    expect(res.status).toBe(400);
    expect(mockUpdateJobType).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is rejected', async () => {
    rejectToken();

    const res = await request(app)
      .put('/me/preferences/job-types')
      .send({ job_types: ['full-time'] });

    expect(res.status).toBe(401);
    expect(mockUpdateJobType).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockUpdateJobType.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .put('/me/preferences/job-types')
      .send({ job_types: ['full-time'] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error.' });
  });
});

export { USER_ID };
