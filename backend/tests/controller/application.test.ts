import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

// ESM mocking: register module mocks BEFORE importing the app, then import it
// dynamically. ts-jest's ESM preset does not hoist jest.mock(), so mocks must be
// registered with unstable_mockModule before the dynamic import of the app.
const addJobApplication = jest.fn<(user_id: string, job_id: string, status: string) => Promise<any>>();
const getUserApplicationStats = jest.fn<(user_id: string) => Promise<any>>();
const getUserApplications = jest.fn<(user_id: string) => Promise<any>>();
const updateApplicationStatus = jest.fn<(user_id: string, application_id: string, status: string) => Promise<any>>();

// requireUser is mocked but reconfigurable so individual tests can simulate a
// missing user (401) while the default lets the request through.
const requireUser = jest.fn((_req: any, _res: any, next: any) => next());

jest.unstable_mockModule('../../src/services/application.service.ts', () => ({
  addJobApplication,
  getUserApplicationStats,
  getUserApplications,
  updateApplicationStatus,
}));

jest.unstable_mockModule('../../src/controller/middleware/requireUser.ts', () => ({
  requireUser: (req: any, res: any, next: any) => requireUser(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';
const APP_ID = 'test-app-id';
const JOB_ID = 'test-job-id';

// Mirrors VALID_STATUSES in application.validate.ts.
const VALID_STATUSES = ['pending', 'draft', 'applied', 'interview', 'offer', 'rejected', 'external'];

// Makes requireUser reject the request with a 401, simulating a non-existent user.
const rejectUser = () =>
  requireUser.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  addJobApplication.mockReset();
  getUserApplicationStats.mockReset();
  getUserApplications.mockReset();
  updateApplicationStatus.mockReset();
  requireUser.mockReset();
  requireUser.mockImplementation((_req: any, _res: any, next: any) => next());
});

describe('POST /applications/:user_id/new', () => {
  it('returns 200 and the created application on valid input', async () => {
    const created = { application_id: APP_ID, job_id: JOB_ID, user_id: USER_ID, status: 'draft' };
    addJobApplication.mockResolvedValue(created);

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'draft' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
    expect(addJobApplication).toHaveBeenCalledWith(USER_ID, JOB_ID, 'draft');
  });

  it.each(VALID_STATUSES)('accepts the valid status "%s"', async (status) => {
    addJobApplication.mockResolvedValue({ application_id: APP_ID, status });

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status });

    expect(res.status).toBe(200);
    expect(addJobApplication).toHaveBeenCalledWith(USER_ID, JOB_ID, status);
  });

  it('normalizes an uppercase status to lowercase before calling the service', async () => {
    addJobApplication.mockResolvedValue({ application_id: APP_ID, status: 'applied' });

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'APPLIED' });

    expect(res.status).toBe(200);
    expect(addJobApplication).toHaveBeenCalledWith(USER_ID, JOB_ID, 'applied');
  });

  it('ignores extra body fields and only forwards job_id and status', async () => {
    addJobApplication.mockResolvedValue({ application_id: APP_ID });

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({
        job_id: JOB_ID,
        status: 'draft',
        company: 'Acme',
        title: 'Engineer',
        description: 'desc',
      });

    expect(res.status).toBe(200);
    expect(addJobApplication).toHaveBeenCalledWith(USER_ID, JOB_ID, 'draft');
  });

  it('returns 400 when job_id is missing', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ status: 'draft' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_id is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is empty', async () => {
    const res = await request(app).post(`/applications/${USER_ID}/new`).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_id is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 400 when status is not a valid value', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'not-a-real-status' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid status.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'draft' });

    expect(res.status).toBe(401);
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service (e.g. 409 conflict)', async () => {
    addJobApplication.mockRejectedValue(new AppError(409, 'Application already exists for this job/user.'));

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'draft' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Application already exists for this job/user.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    addJobApplication.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: 'draft' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });

  it('returns 400 when job_id is an empty string', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: '', status: 'draft' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_id is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 400 when status is an empty string', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('returns 400 when status is whitespace only', async () => {
    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status is required.');
    expect(addJobApplication).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from a valid status and returns 200', async () => {
    addJobApplication.mockResolvedValue({ application_id: APP_ID, status: 'draft' });

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ job_id: JOB_ID, status: '  draft  ' });

    expect(res.status).toBe(200);
    expect(addJobApplication).toHaveBeenCalledWith(USER_ID, JOB_ID, 'draft');
  });

  it('validates the body before checking the user (invalid body + missing user -> 400)', async () => {
    rejectUser();

    const res = await request(app)
      .post(`/applications/${USER_ID}/new`)
      .send({ status: 'draft' }); // missing job_id

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_id is required.');
    expect(requireUser).not.toHaveBeenCalled();
    expect(addJobApplication).not.toHaveBeenCalled();
  });
});

describe('GET /applications/:user_id', () => {
  it('returns 200 and the list of applications for the user', async () => {
    const apps = [
      { application_id: APP_ID, job_id: JOB_ID, status: 'applied', company: 'Acme', title: 'Engineer' },
      { application_id: 'app-2', job_id: 'job-2', status: 'draft', company: 'Globex', title: 'Designer' },
    ];
    getUserApplications.mockResolvedValue(apps);

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apps);
    expect(getUserApplications).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 and an empty array when the user has no applications', async () => {
    getUserApplications.mockResolvedValue([]);

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(401);
    expect(getUserApplications).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service', async () => {
    getUserApplications.mockRejectedValue(new AppError(500, 'Error fetching applications.'));

    const res = await request(app).get(`/applications/${USER_ID}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error fetching applications.');
  });
});

describe('PUT /applications/:user_id/:application_id/status', () => {
  const url = `/applications/${USER_ID}/${APP_ID}/status`;

  it('returns 200 and the updated application on valid input', async () => {
    const updated = { application_id: APP_ID, job_id: JOB_ID, status: 'interview' };
    updateApplicationStatus.mockResolvedValue(updated);

    const res = await request(app).put(url).send({ status: 'interview' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(updateApplicationStatus).toHaveBeenCalledWith(USER_ID, APP_ID, 'interview');
  });

  it.each(VALID_STATUSES)('accepts the valid status "%s"', async (status) => {
    updateApplicationStatus.mockResolvedValue({ application_id: APP_ID, status });

    const res = await request(app).put(url).send({ status });

    expect(res.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(USER_ID, APP_ID, status);
  });

  it('normalizes an uppercase status to lowercase before calling the service', async () => {
    updateApplicationStatus.mockResolvedValue({ application_id: APP_ID, status: 'offer' });

    const res = await request(app).put(url).send({ status: 'OFFER' });

    expect(res.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(USER_ID, APP_ID, 'offer');
  });

  it('trims surrounding whitespace from a valid status and returns 200', async () => {
    updateApplicationStatus.mockResolvedValue({ application_id: APP_ID, status: 'applied' });

    const res = await request(app).put(url).send({ status: '  applied  ' });

    expect(res.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(USER_ID, APP_ID, 'applied');
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app).put(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status is required.');
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status is whitespace only', async () => {
    const res = await request(app).put(url).send({ status: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status is required.');
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when status is not a valid value', async () => {
    const res = await request(app).put(url).send({ status: 'bogus' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid status.');
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).put(url).send({ status: 'applied' });

    expect(res.status).toBe(401);
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service (e.g. 404 not found)', async () => {
    updateApplicationStatus.mockRejectedValue(new AppError(404, 'Application not found for user.'));

    const res = await request(app).put(url).send({ status: 'applied' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Application not found for user.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    updateApplicationStatus.mockRejectedValue(new Error('boom'));

    const res = await request(app).put(url).send({ status: 'applied' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

export { USER_ID, APP_ID };
