import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

const sendJobDescription =
  jest.fn<(user_id: string, job_description: string, company?: string, title?: string) => Promise<any>>();
const addJob = jest.fn<(company: string, title: string, description: string) => Promise<any>>();

const requireUser = jest.fn((_req: any, _res: any, next: any) => next());

jest.unstable_mockModule('../../src/services/job.service.ts', () => ({
  sendJobDescription,
  addJob,
}));

jest.unstable_mockModule('../../src/controller/middleware/requireUser.ts', () => ({
  requireUser: (req: any, res: any, next: any) => requireUser(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';
const JOB_DESCRIPTION = 'We are hiring a Software Engineer to build great things.';
const COMPANY = 'Acme';
const TITLE = 'Software Engineer';

const rejectUser = () =>
  requireUser.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  sendJobDescription.mockReset();
  addJob.mockReset();
  requireUser.mockReset();
  requireUser.mockImplementation((_req: any, _res: any, next: any) => next());
});

describe('POST /jobs/analyze/:user_id', () => {
  const url = `/jobs/analyze/${USER_ID}`;

  it('returns 200 and the AI decision on valid input', async () => {
    const decision = { decision: 'APPLY', employer_instructions: [] };
    sendJobDescription.mockResolvedValue(decision);

    const res = await request(app)
      .post(url)
      .send({ job_description: JOB_DESCRIPTION, company: COMPANY, title: TITLE });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(decision);
    expect(sendJobDescription).toHaveBeenCalledWith(USER_ID, JOB_DESCRIPTION, COMPANY, TITLE);
  });

  it('returns 400 when company is missing', async () => {
    const res = await request(app).post(url).send({ job_description: JOB_DESCRIPTION, title: TITLE });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('company is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post(url).send({ job_description: JOB_DESCRIPTION, company: COMPANY });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it.each([
    ['company', { job_description: JOB_DESCRIPTION, company: '', title: TITLE }, 'company is required.'],
    ['title', { job_description: JOB_DESCRIPTION, company: COMPANY, title: '' }, 'title is required.'],
    ['company (whitespace only)', { job_description: JOB_DESCRIPTION, company: '   ', title: TITLE }, 'company is required.'],
    ['title (whitespace only)', { job_description: JOB_DESCRIPTION, company: COMPANY, title: '   ' }, 'title is required.'],
  ])('returns 400 when %s is empty', async (_label, body, message) => {
    const res = await request(app).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from company and title before calling the service', async () => {
    sendJobDescription.mockResolvedValue({ decision: 'APPLY' });

    const res = await request(app)
      .post(url)
      .send({ job_description: JOB_DESCRIPTION, company: '  Acme  ', title: '  Software Engineer  ' });

    expect(res.status).toBe(200);
    expect(sendJobDescription).toHaveBeenCalledWith(USER_ID, JOB_DESCRIPTION, COMPANY, TITLE);
  });

  it('ignores extra body fields and only forwards the known ones', async () => {
    sendJobDescription.mockResolvedValue({ decision: 'APPLY' });

    const res = await request(app)
      .post(url)
      .send({
        job_description: JOB_DESCRIPTION,
        company: COMPANY,
        title: TITLE,
        status: 'draft',
        salary: 123456,
      });

    expect(res.status).toBe(200);
    expect(sendJobDescription).toHaveBeenCalledWith(USER_ID, JOB_DESCRIPTION, COMPANY, TITLE);
  });

  it('returns 400 when job_description is missing', async () => {
    const res = await request(app).post(url).send({ company: COMPANY, title: TITLE });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_description is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is empty', async () => {
    const res = await request(app).post(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_description is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('returns 400 when job_description is an empty string', async () => {
    const res = await request(app).post(url).send({ job_description: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_description is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('returns 400 when job_description is whitespace only', async () => {
    const res = await request(app).post(url).send({ job_description: '   ', company: COMPANY, title: TITLE });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_description is required.');
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from job_description before calling the service', async () => {
    sendJobDescription.mockResolvedValue({ decision: 'APPLY' });

    const res = await request(app)
      .post(url)
      .send({ job_description: `  ${JOB_DESCRIPTION}  `, company: COMPANY, title: TITLE });

    expect(res.status).toBe(200);
    expect(sendJobDescription).toHaveBeenCalledWith(USER_ID, JOB_DESCRIPTION, COMPANY, TITLE);
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app)
      .post(url)
      .send({ job_description: JOB_DESCRIPTION, company: COMPANY, title: TITLE });

    expect(res.status).toBe(401);
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('validates the body before checking the user (invalid body + missing user -> 400)', async () => {
    rejectUser();

    const res = await request(app).post(url).send({}); // missing job_description

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('job_description is required.');
    expect(requireUser).not.toHaveBeenCalled();
    expect(sendJobDescription).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service (e.g. 404 resume not cached)', async () => {
    sendJobDescription.mockRejectedValue(new AppError(404, 'Short resume not cached.'));

    const res = await request(app)
      .post(url)
      .send({ job_description: JOB_DESCRIPTION, company: COMPANY, title: TITLE });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Short resume not cached.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    sendJobDescription.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .post(url)
      .send({ job_description: JOB_DESCRIPTION, company: COMPANY, title: TITLE });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('POST /jobs/add', () => {
  const url = '/jobs/add';
  const validBody = { company: COMPANY, title: TITLE, description: 'A great role.' };

  it('returns 200 and the created job on valid input', async () => {
    const created = { job_id: 'job-1', ...validBody };
    addJob.mockResolvedValue(created);

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
    expect(addJob).toHaveBeenCalledWith(validBody.company, validBody.title, validBody.description);
  });

  it('ignores extra body fields and only forwards company, title, description', async () => {
    addJob.mockResolvedValue({ job_id: 'job-1' });

    const res = await request(app)
      .post(url)
      .send({ ...validBody, user_id: USER_ID, status: 'draft' });

    expect(res.status).toBe(200);
    expect(addJob).toHaveBeenCalledWith(validBody.company, validBody.title, validBody.description);
  });

  it('returns 400 when company is missing', async () => {
    const res = await request(app).post(url).send({ title: TITLE, description: 'A great role.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('company is required.');
    expect(addJob).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post(url).send({ company: COMPANY, description: 'A great role.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title is required.');
    expect(addJob).not.toHaveBeenCalled();
  });

  it('returns 400 when description is missing', async () => {
    const res = await request(app).post(url).send({ company: COMPANY, title: TITLE });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('description is required.');
    expect(addJob).not.toHaveBeenCalled();
  });

  it('returns 400 with the first error (company) when the body is empty', async () => {
    const res = await request(app).post(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('company is required.');
    expect(addJob).not.toHaveBeenCalled();
  });

  it('returns 400 when a required field is an empty string', async () => {
    const res = await request(app)
      .post(url)
      .send({ company: '', title: TITLE, description: 'A great role.' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('company is required.');
    expect(addJob).not.toHaveBeenCalled();
  });

  it.each([
    ['company', { company: '   ', title: TITLE, description: 'A great role.' }, 'company is required.'],
    ['title', { company: COMPANY, title: '   ', description: 'A great role.' }, 'title is required.'],
    ['description', { company: COMPANY, title: TITLE, description: '   ' }, 'description is required.'],
  ])('returns 400 when %s is whitespace only', async (_label, body, message) => {
    const res = await request(app).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(addJob).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from all fields before calling the service', async () => {
    addJob.mockResolvedValue({ job_id: 'job-1' });

    const res = await request(app)
      .post(url)
      .send({ company: '  Acme  ', title: '  Software Engineer  ', description: '  A great role.  ' });

    expect(res.status).toBe(200);
    expect(addJob).toHaveBeenCalledWith(COMPANY, TITLE, 'A great role.');
  });

  it('propagates an AppError status from the service', async () => {
    addJob.mockRejectedValue(new AppError(409, 'Job already exists.'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Job already exists.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    addJob.mockRejectedValue(new Error('boom'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

export { USER_ID };
