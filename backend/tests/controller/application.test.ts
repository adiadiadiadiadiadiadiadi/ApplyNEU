import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../services/application.service.ts', () => ({
  addJobApplication: jest.fn(),
  getUserApplicationStats: jest.fn(),
  getUserApplications: jest.fn(),
  updateApplicationStatus: jest.fn(),
}));

jest.unstable_mockModule('../../controller/middleware/requireUser.ts', () => ({
  requireUser: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

const { addJobApplication, getUserApplications, updateApplicationStatus } = await import('../../services/application.service.ts');
const { requireUser } = await import('../../controller/middleware/requireUser.ts');
const { app } = await import('../../app.ts');

const USER_ID = 'test-user-id';
const APP_ID = 'test-app-id';

type ServiceMock = jest.Mock<(...args: any[]) => Promise<any>>;
type MiddlewareMock = jest.Mock<(...args: any[]) => any>;

const mockAddJobApplication = addJobApplication as ServiceMock;
const mockGetUserApplications = getUserApplications as ServiceMock;
const mockUpdateApplicationStatus = updateApplicationStatus as ServiceMock;
const mockRequireUser = requireUser as MiddlewareMock;

// Makes requireUser reject the request as if the user_id did not resolve to a real user.
const rejectUnknownUser = () =>
  mockRequireUser.mockImplementationOnce(
    (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) =>
      res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  jest.resetAllMocks();
  mockRequireUser.mockImplementation((_req: unknown, _res: unknown, next: () => void) => next());
});

describe('POST /applications/:user_id/new', () => {
  it('returns 200 and the created application on valid input', async () => {
    const created = { application_id: APP_ID, job_id: 'job-1', status: 'applied' };
    mockAddJobApplication.mockResolvedValue(created);

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: 'job-1', status: 'applied' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
    expect(mockAddJobApplication).toHaveBeenCalledWith(USER_ID, 'job-1', 'applied');
  });

  it('returns 400 when required body fields are missing', async () => {
    const res = await request(app).post(`/applications/${USER_ID}/new`).send({});

    expect(res.status).toBe(400);
    expect(mockAddJobApplication).not.toHaveBeenCalled();
  });

  it('returns 401 when user does not exist', async () => {
    rejectUnknownUser();

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: 'job-1', status: 'applied' });

    expect(res.status).toBe(401);
    expect(mockAddJobApplication).not.toHaveBeenCalled();
  });

  
});

describe('GET /applications/:user_id', () => {
  it('returns 200 and list of applications for the user', async () => {
    const applications = [
      { application_id: APP_ID, job_id: 'job-1', status: 'applied', company: 'Acme', title: 'SWE' },
    ];
    mockGetUserApplications.mockResolvedValue(applications);

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(applications);
    expect(mockGetUserApplications).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 401 when user does not exist', async () => {
    rejectUnknownUser();

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(401);
    expect(mockGetUserApplications).not.toHaveBeenCalled();
  });
});

describe('PUT /applications/:user_id/:application_id/status', () => {
  it('returns 200 and updated application on valid input', async () => {
    const updated = { application_id: APP_ID, job_id: 'job-1', status: 'interview' };
    mockUpdateApplicationStatus.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/applications/${USER_ID}/${APP_ID}/status`)
      .send({ status: 'interview' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(mockUpdateApplicationStatus).toHaveBeenCalledWith(USER_ID, APP_ID, 'interview');
  });

  it('returns 400 when status field is missing', async () => {
    const res = await request(app).put(`/applications/${USER_ID}/${APP_ID}/status`).send({});
    expect(res.status).toBe(400);
    expect(mockUpdateApplicationStatus).not.toHaveBeenCalled();
  });

  it('returns 401 when user does not exist', async () => {
    rejectUnknownUser();

    const res = await request(app)
      .put(`/applications/${USER_ID}/${APP_ID}/status`)
      .send({ status: 'interview' });

    expect(res.status).toBe(401);
    expect(mockUpdateApplicationStatus).not.toHaveBeenCalled();
  });
});

export { USER_ID, APP_ID };
